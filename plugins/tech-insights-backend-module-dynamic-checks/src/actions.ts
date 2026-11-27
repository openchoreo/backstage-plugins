import type {
  AuthService,
  BackstageCredentials,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import type {
  ActionsRegistryActionOptions,
  ActionsRegistryService,
} from '@backstage/backend-plugin-api/alpha';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import {
  AuthorizeResult,
  type BasicPermission,
} from '@backstage/plugin-permission-common';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import {
  dynamicCheckManagePermission,
  dynamicCheckReadPermission,
} from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';
import { randomUUID } from 'crypto';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';
import type { CheckEvaluation } from './dryRun';
import {
  describeProblem,
  dryRunForCaller,
  normalizeEntityRef,
  requireEvaluable,
  requireEvaluation as requireEvaluationOf,
} from './checkOperations';
import { requireReadable, toCatalogRef } from './entityAccess';
import { sharedKindsOf } from './validation';

type Zod = Parameters<
  ActionsRegistryActionOptions<any, any>['schema']['input']
>[0];

const entityRefSchema = (z: Zod) =>
  z
    .string()
    .min(1)
    .describe(
      'Entity ref of the entity to use, e.g. component:default/my-service',
    );

const checkIdSchema = (z: Zod) =>
  z.string().min(1).describe('Check id from list-checks');

const checkInputSchema = (z: Zod) =>
  z.object({
    name: z
      .string()
      .min(1)
      .describe('Short check name, e.g. "Repo not archived"'),
    description: z
      .string()
      .describe(
        'What the check verifies; use an empty string if there is none',
      ),
    factIds: z
      .array(z.string())
      .min(1)
      .describe(
        'Fact retriever ids the rule reads facts from (see list-fact-schemas)',
      ),
    rule: z
      .object({
        conditions: z
          .record(z.unknown())
          .describe(
            'json-rules-engine conditions, e.g. ' +
              '{"all":[{"fact":"githubIsArchived","operator":"equal","value":false}]}',
          ),
      })
      .describe('The json-rules-engine rule'),
  });

type CheckToolInput = {
  name: string;
  description: string;
  factIds: string[];
  rule: { conditions: Record<string, unknown> };
};

// The check-editor form's category, maturity tier and "How to pass", which
// live in the check's metadata. "Not given" is an empty string or a rank of 0.
const metadataSchema = (z: Zod) =>
  z
    .object({
      category: z
        .string()
        .describe(
          'Category, e.g. "Security"; an empty string keeps the saved one',
        ),
      rank: z
        .number()
        .int()
        .min(0)
        .max(3)
        .describe(
          'Maturity tier: 1 Bronze, 2 Silver, 3 Gold; 0 keeps the saved one',
        ),
      solution: z
        .string()
        .describe(
          'How to pass: how to fix a failing check; an empty string keeps the saved one',
        ),
    })
    .describe("The check's category, maturity tier and How to pass text");

type MetadataInput = { category: string; rank: number; solution: string };

/** ``saved`` with the given metadata fields set; empty fields keep it. */
function withMetadata(
  saved: Record<string, unknown> | undefined,
  input: MetadataInput,
): Record<string, unknown> | undefined {
  const metadata = { ...saved };
  if (input.category.trim()) metadata.category = input.category.trim();
  if (input.rank > 0) metadata.rank = input.rank;
  if (input.solution.trim()) metadata.solution = input.solution.trim();
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

type DraftCheck = Omit<TechInsightJsonRuleCheck, 'id'>;

/** Conditions whose top level is a boolean operator, as jsonfc requires. */
function checkConditions(
  conditions: Record<string, unknown>,
): DraftCheck['rule']['conditions'] {
  if (!['all', 'any', 'not'].some(key => key in conditions)) {
    throw new InputError(
      'rule.conditions must be an object whose top level is "all", "any" or "not", ' +
        'e.g. {"all":[{"fact":"githubIsArchived","operator":"equal","value":false}]}',
    );
  }
  return conditions as DraftCheck['rule']['conditions'];
}

/** The tool input as a draft check. */
function toDraftCheck(input: CheckToolInput): DraftCheck {
  return {
    type: 'json-rules-engine',
    name: input.name,
    description: input.description,
    factIds: input.factIds,
    rule: { conditions: checkConditions(input.rule.conditions) },
  };
}

export interface CheckActionsOptions {
  actionsRegistry: ActionsRegistryService;
  registry: DynamicCheckRegistry;
  catalog: CatalogService;
  auth: AuthService;
  permissions: PermissionsService;
  getEvaluation: () => CheckEvaluation | undefined;
}

/**
 * Registers the dynamic-checks Actions Registry actions. With
 * @backstage/plugin-mcp-actions-backend installed they are served as MCP
 * tools (`tech-insights.<name>` with namespaced tool names), and the
 * scaffolder also exposes them as template actions. They share the REST
 * routes' validator, dry-run, errors and entity access (checkOperations.ts,
 * entityAccess.ts).
 *
 * Permissions: every caller is authorized like the REST routes, so the
 * permission policy decides what a user or a service may do. The write
 * actions (create, update, publish, unpublish) also need a signed-in user, so
 * a check is only ever saved on someone's behalf.
 *
 * Validation: create, update and publish run the same CheckValidator as the
 * REST routes. create-check and update-check are stricter than POST and PUT
 * and refuse a rule with problems even for a draft.
 *
 * Every action sets readOnly/destructive/idempotent explicitly: an action
 * with no attributes is treated as destructive.
 */
export function registerCheckActions(options: CheckActionsOptions) {
  const {
    actionsRegistry,
    registry,
    catalog,
    auth,
    permissions,
    getEvaluation,
  } = options;

  async function requireAccess(
    credentials: BackstageCredentials,
    permission: BasicPermission,
    { requireUser }: { requireUser: boolean },
  ) {
    if (requireUser && !auth.isPrincipal(credentials, 'user')) {
      throw new NotAllowedError(
        'Saving checks requires a signed-in user with permission to manage checks.',
      );
    }
    const [decision] = await permissions.authorize([{ permission }], {
      credentials,
    });
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(
        `You don't have the ${permission.name} permission.`,
      );
    }
  }

  const requireEvaluation = () => requireEvaluationOf(getEvaluation);

  async function getExisting(id: string): Promise<TechInsightJsonRuleCheck> {
    try {
      return await registry.get(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new InputError(`No check with id "${id}"; use list-checks.`);
      }
      throw error;
    }
  }

  actionsRegistry.register({
    name: 'list-checks',
    title: 'List checks',
    description:
      'Lists all tech-insights checks, both draft and published, with their id, name, description, factIds and status. ' +
      'Use it to see which checks already exist before drafting a new one.',
    schema: {
      input: z => z.object({}),
      output: z =>
        z.object({
          checks: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string(),
              factIds: z.array(z.string()),
              status: z.enum(['draft', 'published']),
            }),
          ),
        }),
    },
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ credentials }) => {
      await requireAccess(credentials, dynamicCheckReadPermission, {
        requireUser: false,
      });
      const checks = await registry.listAll();
      return {
        output: {
          checks: checks.map(({ id, name, description, factIds, status }) => ({
            id,
            name,
            description: description ?? '',
            factIds,
            status,
          })),
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'get-check',
    title: 'Get check',
    description:
      'Returns one tech-insights check by id, including its full json-rules-engine rule and its status (draft or published).',
    schema: {
      input: z => z.object({ id: checkIdSchema(z) }),
      output: z =>
        z.object({
          check: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            factIds: z.array(z.string()),
            status: z.enum(['draft', 'published']),
            rule: z.record(z.unknown()),
          }),
        }),
    },
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckReadPermission, {
        requireUser: false,
      });
      const check = (await registry.listAll()).find(c => c.id === input.id);
      if (!check) {
        throw new InputError(
          `No check with id "${input.id}"; use list-checks.`,
        );
      }
      return {
        output: {
          check: {
            id: check.id,
            name: check.name,
            description: check.description ?? '',
            factIds: check.factIds,
            status: check.status,
            rule: check.rule as unknown as Record<string, unknown>,
          },
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'list-fact-schemas',
    title: 'List fact schemas',
    description:
      'Lists the facts a check rule can use: for each fact retriever id, the facts it provides with their type and description. ' +
      'Call it before writing a rule so you only use facts that exist.',
    schema: {
      input: z =>
        z.object({
          ids: z
            .array(z.string())
            .describe(
              'Fact retriever ids to limit the result to; an empty array returns all',
            ),
        }),
      output: z => z.object({ schemas: z.array(z.record(z.unknown())) }),
    },
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckReadPermission, {
        requireUser: false,
      });
      const schemas = await requireEvaluation().store.getLatestSchemas(
        input.ids.length ? input.ids : undefined,
      );
      return {
        output: { schemas: schemas as unknown as Record<string, unknown>[] },
      };
    },
  });

  actionsRegistry.register({
    name: 'get-entity-facts',
    title: 'Get entity facts',
    description:
      'Returns the latest real fact values for one entity, keyed by fact retriever id. ' +
      'Use it to see what values a rule will actually be compared against.',
    schema: {
      input: z =>
        z.object({
          entityRef: entityRefSchema(z),
          factIds: z
            .array(z.string())
            .min(1)
            .describe('Fact retriever ids to read'),
        }),
      output: z => z.object({ facts: z.record(z.unknown()) }),
    },
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckReadPermission, {
        requireUser: false,
      });
      const entityRef = normalizeEntityRef(input.entityRef);
      // The same gate as the /facts routes.
      await requireReadable(catalog, credentials, [toCatalogRef(entityRef)]);
      const latest = await requireEvaluation().store.getLatestFactsByIds(
        input.factIds,
        entityRef,
      );
      const facts = Object.fromEntries(
        Object.entries(latest).map(([retrieverId, fact]) => [
          retrieverId,
          { timestamp: fact.timestamp, facts: fact.facts },
        ]),
      );
      return { output: { facts } };
    },
  });

  actionsRegistry.register({
    name: 'dry-run-check',
    title: 'Dry-run check',
    description:
      'Runs a check that is not saved yet against one entity, using the facts already stored for it, and returns ' +
      'its status (passed, failed, not-applicable or invalid), the reasons, and the conditions with the value each ' +
      'fact had. Nothing is saved. A rule that cannot be evaluated comes back as status invalid.',
    schema: {
      input: z =>
        z.object({
          entityRef: entityRefSchema(z),
          check: checkInputSchema(z),
        }),
      output: z =>
        z.object({
          status: z.enum(['passed', 'failed', 'not-applicable', 'invalid']),
          entityRef: z.string(),
          reasons: z.array(
            z.object({
              code: z.string(),
              message: z.string(),
              factRetrieverId: z.string().optional(),
            }),
          ),
          conditions: z
            .unknown()
            .describe(
              "The rule's conditions with each fact condition's factResult and result",
            ),
          collectedAt: z
            .record(z.string())
            .describe('Latest collection time per fact retriever, ISO 8601'),
        }),
    },
    // Read-only: the check is evaluated in memory and nothing is saved.
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: false,
      });
      const result = await dryRunForCaller({
        catalog,
        credentials,
        evaluation: requireEvaluation(),
        entity: input.entityRef,
        check: toDraftCheck(input.check),
      });
      return { output: result };
    },
  });

  actionsRegistry.register({
    name: 'create-check',
    title: 'Create draft check',
    description:
      'Saves a new tech-insights check as a DRAFT, with its category, maturity tier and How to pass text, and returns ' +
      'its id. It applies to the entity kinds its fact retrievers collect facts for. The rule must be valid. ' +
      'Drafts are not evaluated until a person publishes them. ' +
      'Requires a signed-in user who may manage checks.',
    schema: {
      input: z =>
        checkInputSchema(z).extend({
          id: z
            .string()
            .uuid()
            .optional()
            .describe(
              'Id for the new check; a create repeated with the same id is refused instead of saving a second check',
            ),
          metadata: metadataSchema(z),
        }),
      output: z =>
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.literal('draft'),
        }),
    },
    // Idempotent with an id: a repeat is refused, so it saves one check.
    attributes: { readOnly: false, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: true,
      });
      const evaluation = requireEvaluation();
      const metadata = withMetadata(undefined, input.metadata);
      const kinds = sharedKindsOf(
        await evaluation.store.getLatestSchemas(input.factIds),
      );
      const check: TechInsightJsonRuleCheck = {
        ...toDraftCheck(input),
        ...(kinds !== 'all' && kinds.length > 0 && { filter: { kind: kinds } }),
        ...(metadata && { metadata }),
        id: input.id ?? randomUUID(),
      };
      await requireEvaluable(evaluation, check);
      const created = await registry.register(check);
      return {
        output: {
          id: created.id,
          name: created.name,
          status: 'draft' as const,
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'validate-check',
    title: 'Validate check rule',
    description:
      'Reports every problem that stops a rule from being evaluated: an invalid shape or operator, an unknown fact ' +
      'retriever, a fact the selected retrievers do not provide, or retrievers with no entity kind in common. Each ' +
      'problem names the condition it points at. Also returns the entity kinds the check can apply to (empty: any kind). ' +
      'Nothing is saved.',
    schema: {
      input: z =>
        z.object({
          factIds: checkInputSchema(z).shape.factIds,
          rule: checkInputSchema(z).shape.rule,
        }),
      output: z =>
        z.object({
          valid: z.boolean(),
          problems: z.array(z.string()).describe('One line per problem'),
          kinds: z
            .array(z.string())
            .describe(
              'Entity kinds the selected retrievers collect facts for; empty when they are not limited to particular kinds',
            ),
        }),
    },
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: false,
      });
      const evaluation = requireEvaluation();
      const found = await evaluation.validator.problemsOf({
        type: 'json-rules-engine',
        name: '',
        factIds: input.factIds,
        rule: { conditions: checkConditions(input.rule.conditions) },
      });
      const kinds = sharedKindsOf(
        await evaluation.store.getLatestSchemas(input.factIds),
      );
      return {
        output: {
          valid: found.length === 0,
          problems: found.map(describeProblem),
          kinds: kinds === 'all' ? [] : kinds,
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'update-check',
    title: 'Update check',
    description:
      'Replaces the name, description, fact retrievers and rule of an existing check, and sets the category, tier and ' +
      'How to pass text that are given; every other field (entity filter, links, other metadata) is kept. The rule ' +
      'must be valid. A published check changes for every entity at once. Requires a signed-in user who may manage checks.',
    schema: {
      input: z =>
        checkInputSchema(z).extend({
          id: checkIdSchema(z),
          metadata: metadataSchema(z),
        }),
      output: z =>
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.enum(['draft', 'published']),
        }),
    },
    attributes: { readOnly: false, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: true,
      });
      const existing = await getExisting(input.id);
      const draft = toDraftCheck(input);
      const metadata = withMetadata(existing.metadata, input.metadata);
      const updated: TechInsightJsonRuleCheck = {
        ...existing,
        ...draft,
        ...(metadata && { metadata }),
        id: input.id,
        rule: { ...existing.rule, conditions: draft.rule.conditions },
      };
      // Stricter than the REST route, which saves drafts with problems while
      // a person is still editing.
      await requireEvaluable(requireEvaluation(), updated);
      await registry.update(input.id, updated);
      return {
        output: {
          id: input.id,
          name: updated.name,
          status: await registry.getStatus(input.id),
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'publish-check',
    title: 'Publish check',
    description:
      'Publishes a check so it is evaluated for every entity it applies to and counts towards their scores. ' +
      'The check must be valid. Requires a signed-in user who may manage checks.',
    schema: {
      input: z => z.object({ id: checkIdSchema(z) }),
      output: z => z.object({ id: z.string(), status: z.literal('published') }),
    },
    // Destructive: every entity's scores change at once.
    attributes: { readOnly: false, destructive: true, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: true,
      });
      await requireEvaluable(requireEvaluation(), await getExisting(input.id));
      await registry.publish(input.id);
      return { output: { id: input.id, status: 'published' as const } };
    },
  });

  actionsRegistry.register({
    name: 'unpublish-check',
    title: 'Unpublish check',
    description:
      'Turns a published check back into a draft, so it stops being evaluated and drops out of every score. ' +
      'Requires a signed-in user who may manage checks.',
    schema: {
      input: z => z.object({ id: checkIdSchema(z) }),
      output: z => z.object({ id: z.string(), status: z.literal('draft') }),
    },
    // Destructive: every entity's scores change at once.
    attributes: { readOnly: false, destructive: true, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        requireUser: true,
      });
      await getExisting(input.id);
      await registry.unpublish(input.id);
      return { output: { id: input.id, status: 'draft' as const } };
    },
  });
}
