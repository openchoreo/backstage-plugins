import { Engine, Rule } from 'json-rules-engine';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import {
  JSON_RULE_ENGINE_CHECK_TYPE,
  type TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';

export type CheckProblemCode =
  | 'unknown-retriever'
  | 'unknown-fact'
  | 'invalid-rule';

/** Why a check can't be evaluated. */
export interface CheckProblem {
  code: CheckProblemCode;
  message: string;
  factRetrieverId?: string;
  /** JSON pointer into the rule at the condition an invalid rule fails on. */
  path?: string;
  /** The fact an unknown-fact problem is about. */
  fact?: string;
}

/** The parts of a check that decide whether it can be evaluated. */
export type CheckDefinition = Pick<
  TechInsightJsonRuleCheck,
  'type' | 'name' | 'factIds' | 'rule'
>;

/** Keys of a fact schema row that describe the retriever, not a fact. */
export const SCHEMA_METADATA_KEYS = new Set(['id', 'version', 'entityFilter']);

/** Every fact name a rule's conditions reference, as jsonfc collects them. */
export function factNamesIn(condition: unknown): string[] {
  if (!condition || typeof condition !== 'object') return [];
  const node = condition as Record<string, unknown>;
  if (Array.isArray(node.all)) return node.all.flatMap(factNamesIn);
  if (Array.isArray(node.any)) return node.any.flatMap(factNamesIn);
  if ('not' in node) return factNamesIn(node.not);
  if ('condition' in node) return [];
  return typeof node.fact === 'string' ? [node.fact] : [];
}

type FactSchemas = Awaited<ReturnType<TechInsightsStore['getLatestSchemas']>>;

const RULE_CACHE_LIMIT = 500;

const NOOP_EVENT = { type: 'noop' };

type ConditionAt = { node: unknown; path: string };

/** The children of a boolean condition, in json-rules-engine's own order. */
function childrenOf(node: unknown, path: string): ConditionAt[] | undefined {
  if (!node || typeof node !== 'object' || Array.isArray(node))
    return undefined;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(node, key);
  const operator = ['any', 'all', 'not'].find(has);
  if (!operator) return undefined;
  const value = (node as Record<string, unknown>)[operator];
  if (operator === 'not') {
    return Array.isArray(value)
      ? undefined
      : [{ node: value, path: `${path}/not` }];
  }
  return Array.isArray(value)
    ? value.map((child, i) => ({
        node: child,
        path: `${path}/${operator}/${i}`,
      }))
    : undefined;
}

/** Every leaf of a rule's conditions: fact conditions and named references. */
function leavesOf(at: ConditionAt): ConditionAt[] {
  const children = childrenOf(at.node, at.path);
  return children ? children.flatMap(leavesOf) : [at];
}

/**
 * A leaf that builds can only fail to evaluate on what is looked up while it
 * runs: its operator, or the named condition it refers to.
 */
function evaluationFailurePath(leaf: ConditionAt): string {
  const node = leaf.node as Record<string, unknown>;
  if ('operator' in node) return `${leaf.path}/operator`;
  if ('condition' in node) return `${leaf.path}/condition`;
  return leaf.path;
}

function invalidRule(error: unknown, path: string): CheckProblem {
  return {
    code: 'invalid-rule',
    path,
    message: `The rule can't be evaluated: ${(error as Error).message}`,
  };
}

/**
 * The deepest conditions json-rules-engine refuses to build. A boolean
 * condition is blamed only when all of its children build, so each problem
 * points at the condition at fault rather than at the whole rule.
 */
function shapeProblems(at: ConditionAt): CheckProblem[] {
  const nested = (childrenOf(at.node, at.path) ?? []).flatMap(shapeProblems);
  if (nested.length > 0) return nested;
  try {
    // eslint-disable-next-line no-new
    new Rule({ conditions: { all: [at.node as any] }, event: NOOP_EVENT });
    return [];
  } catch (error) {
    return [invalidRule(error, at.path)];
  }
}

/**
 * Whether json-rules-engine, which jsonfc evaluates with, accepts the rule.
 * Building the rule checks its shape (boolean operators, required `fact`,
 * `operator` and `value`). Operators are only looked up while a condition is
 * evaluated, and evaluation stops at the first decisive condition, so each
 * leaf is evaluated on its own against undefined facts. jsonfc's bundled
 * JSON schema isn't used: jsonfc never applies it to the checks it
 * evaluates, and it rejects valid rules that use `not`.
 */
async function ruleProblems(rule: unknown): Promise<CheckProblem[]> {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return [
      {
        code: 'invalid-rule',
        path: '',
        message: 'The rule must be an object.',
      },
    ];
  }
  const { conditions } = rule as { conditions?: unknown };
  if (conditions === undefined) {
    return [
      {
        code: 'invalid-rule',
        path: '',
        message: 'The rule needs a "conditions" object.',
      },
    ];
  }

  const root = { node: conditions, path: '/conditions' };
  const shape = shapeProblems(root);
  if (shape.length > 0) return shape;
  try {
    // eslint-disable-next-line no-new
    new Rule({ conditions: conditions as any, event: NOOP_EVENT });
  } catch (error) {
    return [invalidRule(error, root.path)];
  }

  const problems: CheckProblem[] = [];
  for (const leaf of leavesOf(root)) {
    try {
      await new Engine(
        [{ conditions: { all: [leaf.node as any] }, event: NOOP_EVENT }],
        { allowUndefinedFacts: true },
      ).run({});
    } catch (error) {
      problems.push(invalidRule(error, evaluationFailurePath(leaf)));
    }
  }
  return problems;
}

/**
 * Decides whether a check can be evaluated against the facts tech-insights
 * currently has schemas for.
 *
 * jsonfc throws for the whole evaluation when any one check references a
 * fact no schema defines, so every entity a broken check matches loses all
 * of its results. Running the same rules before publishing, and again when
 * checks are evaluated, keeps one check from taking the others down with it.
 */
export class CheckValidator {
  private readonly ruleResults = new Map<string, CheckProblem[]>();

  constructor(private readonly store: TechInsightsStore) {}

  async problemsOf(check: CheckDefinition): Promise<CheckProblem[]> {
    const [problems] = await this.problemsOfEach([check]);
    return problems;
  }

  /**
   * The problems of each check, in order. Checks are validated every time
   * jsonfc evaluates an entity, so the schemas are read once for the whole
   * set rather than once per check.
   */
  async problemsOfEach(checks: CheckDefinition[]): Promise<CheckProblem[][]> {
    let schemas: Promise<FactSchemas> | undefined;
    const loadSchemas = () => {
      schemas ??= this.store.getLatestSchemas();
      return schemas;
    };
    return Promise.all(
      checks.map(check => this.problemsAgainst(check, loadSchemas)),
    );
  }

  private async problemsAgainst(
    check: CheckDefinition,
    loadSchemas: () => Promise<FactSchemas>,
  ): Promise<CheckProblem[]> {
    if (check.type !== JSON_RULE_ENGINE_CHECK_TYPE) {
      return [
        {
          code: 'invalid-rule',
          message: `Only ${JSON_RULE_ENGINE_CHECK_TYPE} checks can be evaluated.`,
        },
      ];
    }

    const shape = await this.cachedRuleProblems(check.rule);
    if (shape.length > 0) return shape;

    const allSchemas = await loadSchemas();
    const schemas = allSchemas.filter(schema =>
      check.factIds.includes(String(schema.id)),
    );
    const known = new Set(schemas.map(schema => String(schema.id)));
    const unknownRetrievers = check.factIds.filter(id => !known.has(id));
    if (unknownRetrievers.length > 0) {
      return unknownRetrievers.map(factRetrieverId => ({
        code: 'unknown-retriever',
        factRetrieverId,
        message: `No fact retriever named ${factRetrieverId} is registered.`,
      }));
    }

    const provided = new Set(
      schemas.flatMap(schema =>
        Object.keys(schema).filter(name => !SCHEMA_METADATA_KEYS.has(name)),
      ),
    );
    const unknownFacts = [
      ...new Set(factNamesIn(check.rule.conditions)),
    ].filter(name => !provided.has(name));
    return unknownFacts.map(name => {
      const owner = allSchemas.find(
        schema => name in schema && !SCHEMA_METADATA_KEYS.has(name),
      );
      return {
        code: 'unknown-fact',
        fact: name,
        ...(owner && { factRetrieverId: String(owner.id) }),
        message: owner
          ? `Fact ${name} comes from ${owner.id}, which isn't selected for this check.`
          : `No registered fact retriever provides a fact named ${name}.`,
      };
    });
  }

  /**
   * Checks are validated on every evaluation, and whether a rule builds
   * depends on the rule alone, so the outcome is kept per rule.
   */
  private async cachedRuleProblems(
    rule: TechInsightJsonRuleCheck['rule'],
  ): Promise<CheckProblem[]> {
    const key = JSON.stringify(rule);
    const cached = this.ruleResults.get(key);
    if (cached) return cached;
    const problems = await ruleProblems(rule);
    if (this.ruleResults.size >= RULE_CACHE_LIMIT) {
      const oldest = this.ruleResults.keys().next().value;
      if (oldest !== undefined) this.ruleResults.delete(oldest);
    }
    this.ruleResults.set(key, problems);
    return problems;
  }
}
