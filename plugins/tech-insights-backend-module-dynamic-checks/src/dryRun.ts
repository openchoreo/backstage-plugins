import type { Entity } from '@backstage/catalog-model';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import type {
  JsonRulesEngineFactChecker,
  TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import {
  factNamesIn,
  SCHEMA_METADATA_KEYS,
  type CheckValidator,
} from './validation';

/**
 * What evaluation needs from the running tech-insights instance: the fact
 * store it built its checker with, the validator over that store, and a way
 * to build a checker over other checks with the same store and options.
 */
export interface CheckEvaluation {
  store: TechInsightsStore;
  validator: CheckValidator;
  checkerFor(checks: TechInsightJsonRuleCheck[]): JsonRulesEngineFactChecker;
}

export type DryRunStatus = 'passed' | 'failed' | 'not-applicable' | 'invalid';

export type DryRunReasonCode =
  | 'unknown-retriever'
  | 'unknown-fact'
  | 'invalid-rule'
  | 'evaluation-error'
  | 'entity-filtered'
  | 'retriever-not-covering'
  | 'no-facts'
  | 'missing-fact-values'
  | 'no-result'
  | 'empty-selection';

export interface DryRunReason {
  code: DryRunReasonCode;
  message: string;
  factRetrieverId?: string;
}

export interface DryRunResponse {
  status: DryRunStatus;
  entityRef: string;
  reasons: DryRunReason[];
  /**
   * The rule's conditions with each leaf's `factResult` and `result`. A leaf
   * with a `path` has the value the path selected as `factResult`, the
   * fact's JSON cut to `FACT_PREVIEW_LENGTH` characters as `factPreview`
   * (with `factPreviewTruncated` when cut), and `selectedNothing` when the
   * path matched nothing.
   */
  conditions?: unknown;
  /** Latest collection time per selected fact retriever, ISO 8601. */
  collectedAt: Record<string, string>;
}

type DraftCheck = Omit<TechInsightJsonRuleCheck, 'id'>;

const DRAFT_CHECK_ID = 'dry-run';

/*
 * Mirrors jsonfc's filter matching (dot paths, case-insensitive strings,
 * array values as any-of, an array of filters ORed). Used only to explain an
 * empty result; jsonfc itself decides what runs.
 */
function valueAt(entity: Entity, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      entity,
    );
}

function valuesMatch(entityValue: unknown, filterValue: unknown): boolean {
  if (Array.isArray(entityValue)) {
    return entityValue.some(v => valuesMatch(v, filterValue));
  }
  if (typeof entityValue === 'string' && typeof filterValue === 'string') {
    return entityValue.toLowerCase() === filterValue.toLowerCase();
  }
  return entityValue === filterValue;
}

function mismatchedKeys(
  entity: Entity,
  filter: Record<string, unknown>,
): string[] {
  return Object.entries(filter)
    .filter(([key, expected]) => {
      const actual = valueAt(entity, key);
      if (actual === undefined || actual === null) return true;
      const options = Array.isArray(expected) ? expected : [expected];
      return !options.some(option => valuesMatch(actual, option));
    })
    .map(([key]) => key);
}

function describeFilterMismatch(
  entity: Entity,
  filter: unknown,
): string | undefined {
  const filters = (Array.isArray(filter) ? filter : [filter]).filter(
    (f): f is Record<string, unknown> => !!f && typeof f === 'object',
  );
  if (filters.length === 0) return undefined;
  const mismatches = filters.map(f => ({
    filter: f,
    keys: mismatchedKeys(entity, f),
  }));
  if (mismatches.some(m => m.keys.length === 0)) return undefined;
  if (filters.length > 1) {
    return `matches none of the ${filters.length} alternatives`;
  }
  return mismatches[0].keys
    .map(key => {
      const actual = valueAt(entity, key);
      const expected = JSON.stringify(mismatches[0].filter[key]);
      return actual === undefined || actual === null
        ? `has no ${key} (expected ${expected})`
        : `has ${key} ${JSON.stringify(actual)} (expected ${expected})`;
    })
    .join(', ');
}

async function explainEmptyResult(
  check: DraftCheck,
  entity: Entity,
  entityRef: string,
  evaluation: CheckEvaluation,
  facts: Awaited<ReturnType<TechInsightsStore['getLatestFactsByIds']>>,
): Promise<DryRunReason[]> {
  const filterMismatch = check.filter
    ? describeFilterMismatch(entity, check.filter)
    : undefined;
  if (filterMismatch) {
    return [
      {
        code: 'entity-filtered',
        message: `The check's "Applies to" filter excludes ${entityRef}: it ${filterMismatch}.`,
      },
    ];
  }

  const reasons: DryRunReason[] = [];
  const schemas = await evaluation.store.getLatestSchemas(check.factIds);
  const referenced = new Set(factNamesIn(check.rule.conditions));

  for (const factRetrieverId of check.factIds) {
    const schema = schemas.find(s => s.id === (factRetrieverId as unknown));
    const coverage = schema?.entityFilter
      ? describeFilterMismatch(entity, schema.entityFilter)
      : undefined;
    if (coverage) {
      reasons.push({
        code: 'retriever-not-covering',
        factRetrieverId,
        message: `${factRetrieverId} doesn't collect facts for ${entityRef}: the entity ${coverage}.`,
      });
      continue;
    }
    const collected = facts[factRetrieverId];
    if (!collected) {
      reasons.push({
        code: 'no-facts',
        factRetrieverId,
        message: `${factRetrieverId} has no facts for ${entityRef}. Either it hasn't run since this entity appeared, or it skipped the entity because something it needs, such as an annotation or credentials, is missing.`,
      });
      continue;
    }
    const provided = Object.keys(schema ?? {}).filter(
      name => !SCHEMA_METADATA_KEYS.has(name),
    );
    const missing = provided.filter(
      name => referenced.has(name) && !(name in collected.facts),
    );
    if (missing.length > 0) {
      reasons.push({
        code: 'missing-fact-values',
        factRetrieverId,
        message: `${factRetrieverId} collected facts for ${entityRef} but didn't report ${missing.join(
          ', ',
        )}.`,
      });
    }
  }

  return reasons.length > 0
    ? reasons
    : [
        {
          code: 'no-result',
          message: `The check produced no result for ${entityRef}.`,
        },
      ];
}

const LIST_DECORATORS = ['everyFact', 'someFact'];

/** The most characters of a fact's JSON a path condition carries. */
export const FACT_PREVIEW_LENGTH = 300;

function factPreview(
  value: unknown,
): { factPreview: string; factPreviewTruncated?: true } | undefined {
  if (value === undefined || value === null) return undefined;
  const json = JSON.stringify(value);
  return json.length > FACT_PREVIEW_LENGTH
    ? {
        factPreview: json.slice(0, FACT_PREVIEW_LENGTH),
        factPreviewTruncated: true,
      }
    : { factPreview: json };
}

/**
 * Adds a preview of the fact to every evaluated leaf with a `path`, beside
 * the value json-rules-engine selected with it (`factResult`), and reports
 * the paths that selected nothing. The engine leaves `factResult` out when
 * the path matched nothing, as JSONPath without wrapping returns undefined
 * then. A leaf's `result` is before any enclosing `not`, so `negated` tracks
 * those to name the outcome the condition had in the rule.
 */
function explainPaths(
  node: unknown,
  factValues: Record<string, unknown>,
  entityRef: string,
  reasons: DryRunReason[],
  negated = false,
): unknown {
  if (!node || typeof node !== 'object') return node;
  const n = node as Record<string, unknown>;
  const explain = (child: unknown, childNegated = negated) =>
    explainPaths(child, factValues, entityRef, reasons, childNegated);
  if (Array.isArray(n.all)) {
    return { ...n, all: n.all.map(c => explain(c)) };
  }
  if (Array.isArray(n.any)) {
    return { ...n, any: n.any.map(c => explain(c)) };
  }
  if ('not' in n) {
    return { ...n, not: explain(n.not, !negated) };
  }
  if (typeof n.fact !== 'string' || typeof n.path !== 'string') return n;
  const factValue = factValues[n.fact];
  const selectedNothing =
    typeof n.result === 'boolean' &&
    !('factResult' in n) &&
    factValue !== null &&
    typeof factValue === 'object';
  if (selectedNothing) {
    const listOperator = String(n.operator)
      .split(':')
      .slice(0, -1)
      .some(part => LIST_DECORATORS.includes(part));
    let consequence = '.';
    if (listOperator) {
      consequence =
        n.result !== negated
          ? ' and passed only because nothing was selected.'
          : ' and failed because nothing was selected.';
    }
    reasons.push({
      code: 'empty-selection',
      message: `The path "${n.path}" selected nothing from ${n.fact} for ${entityRef}, so its condition had no value to compare${consequence}`,
    });
  }
  return {
    ...n,
    ...factPreview(factValue),
    ...(selectedNothing && { selectedNothing }),
  };
}

/**
 * Validates the draft, runs it through a checker built like the one that
 * evaluates published checks but holding only the draft, and explains an
 * empty result. Nothing is stored.
 */
export async function dryRunCheck(options: {
  check: DraftCheck;
  entity: Entity;
  entityRef: string;
  evaluation: CheckEvaluation;
}): Promise<DryRunResponse> {
  const { check, entity, entityRef, evaluation } = options;
  const facts = await evaluation.store.getLatestFactsByIds(
    check.factIds,
    entityRef,
  );
  const collectedAt: Record<string, string> = {};
  for (const [id, fact] of Object.entries(facts)) {
    const iso = fact.timestamp?.toISO();
    if (iso) collectedAt[id] = iso;
  }
  const respond = (
    status: DryRunStatus,
    reasons: DryRunReason[],
    conditions?: unknown,
  ): DryRunResponse => ({
    status,
    entityRef,
    reasons,
    conditions,
    collectedAt,
  });

  const draft: TechInsightJsonRuleCheck = {
    ...check,
    type: check.type ?? 'json-rules-engine',
    id: DRAFT_CHECK_ID,
  };
  const problems = await evaluation.validator.problemsOf(draft);
  if (problems.length > 0) {
    return respond('invalid', problems);
  }

  let results;
  try {
    results = await evaluation
      .checkerFor([draft])
      .runChecks(entityRef, [draft.id]);
  } catch (e) {
    return respond('invalid', [
      { code: 'evaluation-error', message: (e as Error).message },
    ]);
  }

  const [result] = results;
  if (result) {
    const factValues = Object.fromEntries(
      Object.entries(result.facts ?? {}).map(([name, fact]) => [
        name,
        fact.value,
      ]),
    );
    const reasons: DryRunReason[] = [];
    const conditions = explainPaths(
      result.check.rule?.conditions,
      factValues,
      entityRef,
      reasons,
    );
    return respond(result.result ? 'passed' : 'failed', reasons, conditions);
  }
  return respond(
    'not-applicable',
    await explainEmptyResult(check, entity, entityRef, evaluation, facts),
  );
}
