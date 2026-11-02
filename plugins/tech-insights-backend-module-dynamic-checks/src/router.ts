import { randomUUID } from 'crypto';
import express from 'express';
import Router from 'express-promise-router';
import type {
  HttpAuthService,
  LoggerService,
  PermissionsService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import {
  InputError,
  NotAllowedError,
  NotFoundError,
  ServiceUnavailableError,
} from '@backstage/errors';
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
import { DynamicCheckRegistry } from './DynamicCheckRegistry';
import { dryRunCheck, type CheckEvaluation } from './dryRun';

interface RouterOptions {
  logger: LoggerService;
  registry: DynamicCheckRegistry;
  catalog: CatalogService;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  scheduler: SchedulerService;
  getEvaluation: () => CheckEvaluation | undefined;
}

function basicValidate(check: Partial<TechInsightJsonRuleCheck>) {
  if (!check.name) throw new InputError('A check needs a name.');
  if (!Array.isArray(check.factIds) || check.factIds.length === 0) {
    throw new InputError('Select at least one fact retriever.');
  }
  if (!check.rule?.conditions) {
    throw new InputError('The rule needs a "conditions" object.');
  }
  if (check.links !== undefined) {
    if (
      !Array.isArray(check.links) ||
      !check.links.every(
        link =>
          typeof link?.title === 'string' &&
          link.title.trim() &&
          typeof link.url === 'string' &&
          link.url.trim(),
      )
    ) {
      throw new InputError('Each link needs a title and a URL.');
    }
  }
  for (const key of ['successMetadata', 'failureMetadata'] as const) {
    const value = check[key];
    if (value === undefined) continue;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new InputError(`${key} must be a JSON object.`);
    }
    // jsonfc merges these into `metadata` per result, and tiers are computed
    // from the merged `rank`, so a pass- or fail-only rank would move tiers.
    if ('rank' in value || 'category' in value) {
      throw new InputError(`Set rank and category in metadata, not in ${key}.`);
    }
  }
}

function normalizeEntityRef(entity: unknown): string {
  if (typeof entity !== 'string' || !entity.trim()) {
    throw new InputError(
      'Enter an entity ref to dry-run against, e.g. component:default/my-service.',
    );
  }
  try {
    return stringifyEntityRef(parseEntityRef(entity.trim()));
  } catch {
    throw new InputError(
      `"${entity}" isn't a complete entity ref. Use kind:namespace/name, e.g. component:default/my-service.`,
    );
  }
}

export async function createDynamicChecksRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const {
    logger,
    registry,
    catalog,
    httpAuth,
    permissions,
    scheduler,
    getEvaluation,
  } = options;
  const router = Router();
  router.use(express.json());

  async function authorize(req: express.Request, permission: BasicPermission) {
    const [decision] = await permissions.authorize([{ permission }], {
      credentials: await httpAuth.credentials(req),
    });
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(
        `You don't have the ${permission.name} permission.`,
      );
    }
  }

  function requireEvaluation(): CheckEvaluation {
    const evaluation = getEvaluation();
    if (!evaluation) {
      throw new ServiceUnavailableError(
        'Check evaluation is not ready yet; try again shortly.',
      );
    }
    return evaluation;
  }

  /** Refuses a check that can't be evaluated against the current facts. */
  async function requireEvaluable(check: TechInsightJsonRuleCheck) {
    const problems = await requireEvaluation().validator.problemsOf(check);
    if (problems.length > 0) {
      throw new InputError(
        `The check can't be evaluated: ${problems
          .map(problem => problem.message)
          .join(' ')}`,
      );
    }
  }

  router.get('/dynamic-checks', async (req, res) => {
    await authorize(req, dynamicCheckReadPermission);
    const checks = await registry.listAll();
    const validator = getEvaluation()?.validator;
    if (!validator) {
      res.json(checks);
      return;
    }
    const problemsOfEach = await validator.problemsOfEach(checks);
    res.json(
      checks.map((check, index) =>
        problemsOfEach[index].length > 0
          ? { ...check, problems: problemsOfEach[index] }
          : check,
      ),
    );
  });

  router.post('/dynamic-checks', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    const check: TechInsightJsonRuleCheck = {
      type: 'json-rules-engine',
      ...req.body,
      id: req.body.id ?? randomUUID(),
    };
    basicValidate(check);
    const created = await registry.register(check);
    res.status(201).json(created);
  });

  router.put('/dynamic-checks/:id', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    const check: TechInsightJsonRuleCheck = {
      type: 'json-rules-engine',
      ...req.body,
      id: req.params.id,
    };
    basicValidate(check);
    // Changes to a published check apply at once, so they must evaluate.
    if ((await registry.getStatus(req.params.id)) === 'published') {
      await requireEvaluable(check);
    }
    const updated = await registry.update(req.params.id, check);
    res.json(updated);
  });

  router.delete('/dynamic-checks/:id', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    await registry.delete(req.params.id);
    res.status(204).end();
  });

  router.post('/dynamic-checks/:id/publish', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    await requireEvaluable(await registry.get(req.params.id));
    await registry.publish(req.params.id);
    res.status(204).end();
  });

  router.post('/dynamic-checks/:id/unpublish', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    await registry.unpublish(req.params.id);
    res.status(204).end();
  });

  router.post('/dynamic-checks/dry-run', async (req, res) => {
    await authorize(req, dynamicCheckManagePermission);
    const { entity, check } = (req.body ?? {}) as {
      entity?: unknown;
      check?: Omit<TechInsightJsonRuleCheck, 'id'>;
    };
    const entityRef = normalizeEntityRef(entity);
    if (!check) throw new InputError('The request has no check to dry-run.');
    basicValidate(check);

    const evaluation = requireEvaluation();
    const catalogEntity = await catalog.getEntityByRef(entityRef, {
      credentials: await httpAuth.credentials(req),
    });
    if (!catalogEntity) {
      throw new NotFoundError(`No entity ${entityRef} in the catalog.`);
    }

    res.json(
      await dryRunCheck({
        check,
        entity: catalogEntity,
        entityRef,
        evaluation,
      }),
    );
  });

  // The scheduler's own /.backstage/scheduler/v1/tasks/:id/trigger route does
  // no permission check, so collection is started through this route instead.
  router.post(
    '/dynamic-checks/fact-retrievers/:id/trigger',
    async (req, res) => {
      await authorize(req, dynamicCheckManagePermission);
      const { id } = req.params;
      const schemas = await requireEvaluation().store.getLatestSchemas([id]);
      if (!schemas.some(schema => String(schema.id) === id)) {
        throw new NotFoundError(`No fact retriever ${id} is registered.`);
      }
      // Throws ConflictError (409) when a run is already in progress.
      await scheduler.triggerTask(id);
      res.status(202).end();
    },
  );

  logger.info('Dynamic checks router mounted');
  return router;
}
