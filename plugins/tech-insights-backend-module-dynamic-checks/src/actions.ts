import type {
  AuthService,
  BackstageCredentials,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import type {
  ActionsRegistryActionOptions,
  ActionsRegistryService,
} from '@backstage/backend-plugin-api/alpha';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
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
import { dryRunCheck, type CheckEvaluation } from './dryRun';
import type { CheckProblem } from './validation';

type Zod = Parameters<
  ActionsRegistryActionOptions<any, any>['schema']['input']
>[0];

// Earlier versions saved a temporary check for each dry-run, and a crash
// mid-run could leave one behind in the database; never show those to tools.
const DRY_RUN_ID_PREFIX = '__dryrun__';

const entityRefSchema = (z: Zod) =>
  z
    .string()
    .min(1)
    .describe(
      'Entity ref of the component to use, e.g. component:default/my-service',
    );

const checkIdSchema = (z: Zod) =>
  z.string().min(1).describe('Check id from list_checks');

// Input schemas must stay valid for OpenAI strict function calling, which
// the Portal Assistant turns on for every tool: every field required (no
// .optional()) and no free-form objects (no z.record / z.unknown). That is
// why rule.conditions travels as a JSON string. See actions.test.ts.
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
        'Fact retriever ids the rule reads facts from (see list_fact_schemas)',
      ),
    rule: z
      .object({
        conditions: z
          .string()
          .min(1)
          .describe(
            'json-rules-engine conditions as a JSON string, e.g. ' +
              '{"all":[{"fact":"githubIsArchived","operator":"equal","value":false}]}',
          ),
      })
      .describe('The json-rules-engine rule'),
  });

type CheckToolInput = {
  name: string;
  description: string;
  factIds: string[];
  rule: { conditions: string };
};

// The check-editor form's category, maturity tier and "How to pass", which
// live in the check's metadata. Every field is required (strict function
// calling), so "not given" is an empty string or a rank of 0.
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

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Parses JSON-string conditions. Errors are InputErrors with a fix-it hint,
 * so an agent can correct its call instead of retrying blindly.
 */
function parseConditions(raw: string): DraftCheck['rule']['conditions'] {
  let conditions: unknown;
  try {
    conditions = JSON.parse(raw);
  } catch (err) {
    throw new InputError(
      `rule.conditions is not valid JSON: ${(err as Error).message}`,
    );
  }
  // LLMs often repeat the field name: {"conditions":{"all":[...]}}. The
  // intent is unambiguous, so unwrap it rather than fail.
  if (
    isObject(conditions) &&
    Object.keys(conditions).length === 1 &&
    isObject(conditions.conditions)
  ) {
    conditions = conditions.conditions;
  }
  if (
    !isObject(conditions) ||
    !['all', 'any', 'not'].some(key => key in conditions)
  ) {
    throw new InputError(
      'rule.conditions must be a JSON object whose top level is "all", "any" or "not", ' +
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
    rule: { conditions: parseConditions(input.rule.conditions) },
  };
}

/** A problem with the condition it points at, so an agent can fix that one. */
function describeProblem(problem: CheckProblem): string {
  return problem.path
    ? `${problem.message} (at ${problem.path})`
    : problem.message;
}

/**
 * The kinds an entity filter matches, or undefined when it matches every
 * kind: no filter, or an entry without a kind. A filter is one object or an
 * array of them, any of which may match.
 */
function kindsOfFilter(filter: unknown): string[] | undefined {
  const entries = [filter ?? []].flat() as unknown[];
  if (entries.length === 0) return undefined;
  const kinds: string[] = [];
  for (const entry of entries) {
    if (!isObject(entry)) return undefined;
    const key = Object.keys(entry).find(k => k.toLowerCase() === 'kind');
    const named = key
      ? [entry[key]].flat().filter((v): v is string => typeof v === 'string')
      : [];
    if (named.length === 0) return undefined;
    kinds.push(...named);
  }
  return kinds;
}

/**
 * The kinds every selected fact retriever collects facts for, or undefined
 * when none of them is limited to particular kinds. Empty means they have no
 * kind in common, so the check could never have a result.
 */
async function sharedKinds(
  evaluation: CheckEvaluation,
  factIds: string[],
): Promise<string[] | undefined> {
  const schemas = await evaluation.store.getLatestSchemas(factIds);
  let shared: string[] | undefined;
  for (const schema of schemas) {
    const kinds = kindsOfFilter(schema.entityFilter);
    if (kinds) {
      const lower = kinds.map(kind => kind.toLowerCase());
      shared = shared
        ? shared.filter(kind => lower.includes(kind.toLowerCase()))
        : kinds;
    }
  }
  return shared;
}

const noSharedKind = (factIds: string[]) =>
  `${factIds.join(
    ', ',
  )} don't collect facts for any of the same entity kinds, so the check would never have a result.`;

function toEntityRef(entity: string): string {
  try {
    return stringifyEntityRef(parseEntityRef(entity.trim()));
  } catch {
    throw new InputError(
      `"${entity}" isn't a complete entity ref. Use kind:namespace/name, e.g. component:default/my-service.`,
    );
  }
}

/** Collects `fact -> factResult` from a dry-run's evaluated conditions. */
function factValuesIn(node: unknown, out: Record<string, unknown> = {}) {
  if (Array.isArray(node)) {
    node.forEach(child => factValuesIn(child, out));
  } else if (isObject(node)) {
    if (typeof node.fact === 'string' && 'factResult' in node) {
      out[node.fact] = node.factResult;
    }
    for (const key of ['all', 'any', 'not']) {
      if (key in node) factValuesIn(node[key], out);
    }
  }
  return out;
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
 * tools (id `tech-insights:<name>`), and the scaffolder also exposes them as
 * template actions. They reuse this module's registry, dry-run and fact
 * store, so they behave like the REST routes.
 *
 * Permissions: a signed-in user gets exactly the REST routes' checks. A
 * service caller (e.g. the Portal Assistant's static token, which carries no
 * user) may only read, validate and dry-run — nothing it does is saved. The
 * write actions (create, update, publish, unpublish) need a user, so they only
 * work when the assistant calls on behalf of the signed-in user.
 *
 * Validation: update and publish run the same CheckValidator as the REST
 * routes. update_check is stricter than PUT and refuses a rule with problems
 * even for a draft.
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
    { allowService }: { allowService: boolean },
  ) {
    if (auth.isPrincipal(credentials, 'user')) {
      const [decision] = await permissions.authorize([{ permission }], {
        credentials,
      });
      if (decision.result !== AuthorizeResult.ALLOW) {
        throw new NotAllowedError(
          `You don't have the ${permission.name} permission.`,
        );
      }
      return;
    }
    if (allowService && auth.isPrincipal(credentials, 'service')) return;
    throw new NotAllowedError(
      allowService
        ? 'This tool requires a signed-in user or service credentials.'
        : 'Saving checks requires a signed-in user with permission to manage checks; ' +
          'the assistant can only read and dry-run.',
    );
  }

  function requireEvaluation(): CheckEvaluation {
    const evaluation = getEvaluation();
    if (!evaluation) {
      throw new InputError(
        'Check evaluation is not ready yet; try again shortly.',
      );
    }
    return evaluation;
  }

  /**
   * Refuses a check that can't be evaluated against the current facts. The
   * same validator backs the REST validate, update and publish routes.
   */
  async function requireEvaluable(check: TechInsightJsonRuleCheck) {
    const problems = await requireEvaluation().validator.problemsOf(check);
    if (problems.length > 0) {
      throw new InputError(
        `The check can't be evaluated: ${problems
          .map(describeProblem)
          .join(' ')}`,
      );
    }
  }

  async function getExisting(id: string): Promise<TechInsightJsonRuleCheck> {
    try {
      return await registry.get(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new InputError(`No check with id "${id}"; use list_checks.`);
      }
      throw error;
    }
  }

  actionsRegistry.register({
    name: 'list_checks',
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
        allowService: true,
      });
      const checks = await registry.listAll();
      return {
        output: {
          checks: checks
            .filter(check => !check.id.startsWith(DRY_RUN_ID_PREFIX))
            .map(({ id, name, description, factIds, status }) => ({
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
    name: 'get_check',
    title: 'Get check',
    description:
      'Returns one tech-insights check by id, including its full json-rules-engine rule and its status (draft or published).',
    schema: {
      input: z =>
        z.object({
          id: z.string().min(1).describe('Check id from list_checks'),
        }),
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
        allowService: true,
      });
      const check = (await registry.listAll()).find(c => c.id === input.id);
      if (!check) {
        throw new InputError(
          `No check with id "${input.id}"; use list_checks.`,
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
    name: 'list_fact_schemas',
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
        allowService: true,
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
    name: 'get_entity_facts',
    title: 'Get entity facts',
    description:
      'Returns the latest real fact values for one component, keyed by fact retriever id. ' +
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
        allowService: true,
      });
      // The /facts routes check catalog access (entityAccess.ts); so does this.
      const entityRef = toEntityRef(input.entityRef);
      if (!(await catalog.getEntityByRef(entityRef, { credentials }))) {
        throw new InputError(`No entity ${entityRef} in the catalog.`);
      }
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
    name: 'dry_run_check',
    title: 'Dry-run check',
    description:
      'Runs a check that is not saved yet against one component, using the facts already stored for it, and returns ' +
      'whether it passes, the actual fact values and the reasons. Nothing is saved. Use it to test a rule before creating the check.',
    schema: {
      input: z =>
        z.object({
          entityRef: entityRefSchema(z),
          check: checkInputSchema(z),
        }),
      output: z =>
        z.object({
          status: z.enum(['passed', 'failed', 'not-applicable', 'invalid']),
          passed: z.boolean(),
          summary: z.string().describe('Plain-language reading of the result'),
          factValues: z
            .record(z.unknown())
            .describe('The actual value of each fact the rule compared'),
          reasons: z.array(z.object({ code: z.string(), message: z.string() })),
        }),
    },
    // Read-only: the check is evaluated in memory and nothing is saved.
    attributes: { readOnly: true, destructive: false, idempotent: true },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        allowService: true,
      });
      const check = toDraftCheck(input.check);
      const entityRef = toEntityRef(input.entityRef);
      const entity = await catalog.getEntityByRef(entityRef, { credentials });
      if (!entity) {
        throw new InputError(`No entity ${entityRef} in the catalog.`);
      }
      const result = await dryRunCheck({
        check,
        entity,
        entityRef,
        evaluation: requireEvaluation(),
      });
      const reasons = result.reasons.map(({ code, message }) => ({
        code,
        message,
      }));
      const reasonText = reasons.map(r => r.message).join(' ');

      // A rule tech-insights can't evaluate (unknown fact, bad operator) is
      // a fixable input problem; surface it as one.
      if (result.status === 'invalid') {
        throw new InputError(`The check could not be evaluated: ${reasonText}`);
      }

      const factValues = factValuesIn(result.conditions);
      const values = Object.entries(factValues)
        .map(([name, value]) => `${name} = ${JSON.stringify(value)}`)
        .join(', ');
      // Agents tend to read a failure as their own mistake and rewrite the
      // rule until it passes, which inverts the check. Say plainly that this
      // is the answer, not an error.
      const summary =
        result.status === 'not-applicable'
          ? `The check does not apply to ${entityRef}: ${reasonText} ` +
            "Report this; do not change the rule's meaning."
          : `The check was evaluated successfully: ${entityRef} ` +
            `${
              result.status === 'passed' ? 'MEETS' : 'does NOT meet'
            } this rule` +
            `${
              values ? ` (${values})` : ''
            }. This is the final result — report it; ` +
            'do not change the rule to make it pass.';
      return {
        output: {
          status: result.status,
          passed: result.status === 'passed',
          summary,
          factValues,
          reasons,
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'create_check',
    title: 'Create draft check',
    description:
      'Saves a new tech-insights check as a DRAFT, with its category, maturity tier and How to pass text, and returns ' +
      'its id. It applies to the entity kinds its fact retrievers collect facts for. ' +
      'Drafts are not evaluated until a person publishes them. ' +
      'Requires a signed-in user who may manage checks. Dry-run the check first.',
    schema: {
      input: z => checkInputSchema(z).extend({ metadata: metadataSchema(z) }),
      output: z =>
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.literal('draft'),
        }),
    },
    attributes: { readOnly: false, destructive: false, idempotent: false },
    action: async ({ input, credentials }) => {
      await requireAccess(credentials, dynamicCheckManagePermission, {
        allowService: false,
      });
      const metadata = withMetadata(undefined, input.metadata);
      const kinds = await sharedKinds(requireEvaluation(), input.factIds);
      if (kinds?.length === 0) {
        throw new InputError(noSharedKind(input.factIds));
      }
      const created = await registry.register({
        ...toDraftCheck(input),
        ...(kinds && { filter: { kind: kinds } }),
        ...(metadata && { metadata }),
        id: randomUUID(),
      });
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
    name: 'validate_check',
    title: 'Validate check rule',
    description:
      'Reports every problem that stops a rule from being evaluated: an invalid shape or operator, an unknown fact ' +
      'retriever, a fact the selected retrievers do not provide, or retrievers with no entity kind in common. Each ' +
      'problem names the condition it points at. Also returns the entity kinds the check can apply to (empty: any kind). ' +
      'Nothing is saved. Use it to check an edited rule when no component is named to dry-run against.',
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
        allowService: true,
      });
      const evaluation = requireEvaluation();
      const found = await evaluation.validator.problemsOf({
        type: 'json-rules-engine',
        name: '',
        factIds: input.factIds,
        rule: { conditions: parseConditions(input.rule.conditions) },
      });
      const kinds = await sharedKinds(evaluation, input.factIds);
      const problems = found.map(describeProblem);
      if (kinds?.length === 0) problems.push(noSharedKind(input.factIds));
      return {
        output: {
          valid: problems.length === 0,
          problems,
          kinds: kinds ?? [],
        },
      };
    },
  });

  actionsRegistry.register({
    name: 'update_check',
    title: 'Update check',
    description:
      'Replaces the name, description, fact retrievers and rule of an existing check, and sets the category, tier and ' +
      'How to pass text that are given; every other field (links, other metadata) is kept. The rule must be valid. ' +
      'A published check changes for every entity at once. Requires a signed-in user who may manage checks.',
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
        allowService: false,
      });
      const existing = await getExisting(input.id);
      // The saved entity filter is kept, so the retrievers must still collect
      // facts for one of its kinds.
      const kinds = await sharedKinds(requireEvaluation(), input.factIds);
      const filterKinds = kindsOfFilter(existing.filter);
      if (kinds?.length === 0) {
        throw new InputError(noSharedKind(input.factIds));
      }
      if (
        kinds &&
        filterKinds &&
        !kinds.some(kind =>
          filterKinds.some(k => k.toLowerCase() === kind.toLowerCase()),
        )
      ) {
        throw new InputError(
          `${input.factIds.join(
            ', ',
          )} don't collect facts for ${filterKinds.join(
            ', ',
          )}, the kinds this check applies to, so it would never have a result.`,
        );
      }
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
      // a person is still editing: the assistant never saves a broken rule.
      await requireEvaluable(updated);
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
    name: 'publish_check',
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
        allowService: false,
      });
      await requireEvaluable(await getExisting(input.id));
      await registry.publish(input.id);
      return { output: { id: input.id, status: 'published' as const } };
    },
  });

  actionsRegistry.register({
    name: 'unpublish_check',
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
        allowService: false,
      });
      await getExisting(input.id);
      await registry.unpublish(input.id);
      return { output: { id: input.id, status: 'draft' as const } };
    },
  });
}
