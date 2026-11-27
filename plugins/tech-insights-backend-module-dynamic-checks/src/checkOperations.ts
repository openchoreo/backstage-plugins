import type { BackstageCredentials } from '@backstage/backend-plugin-api';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import {
  InputError,
  NotFoundError,
  ServiceUnavailableError,
} from '@backstage/errors';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import {
  dryRunCheck,
  type CheckEvaluation,
  type DryRunResponse,
} from './dryRun';
import type { CheckProblem } from './validation';

/*
 * What the REST routes and the Actions Registry actions both do, so the two
 * give the same answers and errors.
 */

export function normalizeEntityRef(entity: unknown): string {
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

export function requireEvaluation(
  getEvaluation: () => CheckEvaluation | undefined,
): CheckEvaluation {
  const evaluation = getEvaluation();
  if (!evaluation) {
    throw new ServiceUnavailableError(
      'Check evaluation is not ready yet; try again shortly.',
    );
  }
  return evaluation;
}

/** A problem with the condition it points at, if any. */
export function describeProblem(problem: CheckProblem): string {
  return problem.path
    ? `${problem.message} (at ${problem.path})`
    : problem.message;
}

/** Refuses a check that can't be evaluated against the current facts. */
export async function requireEvaluable(
  evaluation: CheckEvaluation,
  check: TechInsightJsonRuleCheck,
) {
  const problems = await evaluation.validator.problemsOf(check);
  if (problems.length > 0) {
    throw new InputError(
      `The check can't be evaluated: ${problems
        .map(describeProblem)
        .join(' ')}`,
    );
  }
}

/**
 * Dry-runs an unsaved check against one entity the caller can see. A rule
 * that can't be evaluated comes back as an `invalid` result, not an error.
 */
export async function dryRunForCaller(options: {
  catalog: CatalogService;
  credentials: BackstageCredentials;
  evaluation: CheckEvaluation;
  entity: unknown;
  check: Omit<TechInsightJsonRuleCheck, 'id'>;
}): Promise<DryRunResponse> {
  const { catalog, credentials, evaluation, check } = options;
  const entityRef = normalizeEntityRef(options.entity);
  const entity = await catalog.getEntityByRef(entityRef, { credentials });
  if (!entity) {
    throw new NotFoundError(`No entity ${entityRef} in the catalog.`);
  }
  return dryRunCheck({ check, entity, entityRef, evaluation });
}
