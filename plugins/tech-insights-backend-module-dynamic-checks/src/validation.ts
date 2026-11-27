import { Engine, Rule } from 'json-rules-engine';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import {
  JSON_RULE_ENGINE_CHECK_TYPE,
  type TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import {
  filterCoversKinds,
  kindsOfFilter,
} from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';

export type CheckProblemCode =
  | 'unknown-retriever'
  | 'unknown-fact'
  | 'invalid-rule'
  | 'kind-mismatch';

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
> &
  Partial<Pick<TechInsightJsonRuleCheck, 'filter'>>;

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

/**
 * The kinds every one of the fact retrievers collects facts for, or `'all'`
 * when none of them is limited to particular kinds. Empty means they have no
 * kind in common, so a check reading them could never have a result.
 */
export function sharedKindsOf(schemas: FactSchemas): string[] | 'all' {
  let shared: string[] | 'all' = 'all';
  for (const schema of schemas) {
    const kinds = kindsOfFilter(schema.entityFilter);
    if (kinds !== 'all') {
      shared =
        shared === 'all'
          ? kinds
          : shared.filter(kind => filterCoversKinds({ kind: kinds }, [kind]));
    }
  }
  return shared;
}

/**
 * A check whose retrievers share no entity kind, or don't collect facts for
 * any kind its own filter allows, is never evaluated for any entity.
 */
function kindProblems(
  check: CheckDefinition,
  schemas: FactSchemas,
): CheckProblem[] {
  const shared = sharedKindsOf(schemas);
  if (shared === 'all') return [];
  const retrievers = check.factIds.join(', ');
  if (shared.length === 0) {
    return [
      {
        code: 'kind-mismatch',
        message: `${retrievers} don't collect facts for any of the same entity kinds, so the check would never have a result.`,
      },
    ];
  }
  const filterKinds = kindsOfFilter(check.filter);
  if (filterKinds === 'all' || filterCoversKinds(check.filter, shared)) {
    return [];
  }
  return [
    {
      code: 'kind-mismatch',
      message: `${retrievers} don't collect facts for ${filterKinds.join(
        ', ',
      )}, the kinds this check applies to, so it would never have a result.`,
    },
  ];
}

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

/** json-rules-engine's operators that only compare numbers. */
const NUMBER_OPERATORS = new Set([
  'lessThan',
  'lessThanInclusive',
  'greaterThan',
  'greaterThanInclusive',
]);

/** Fact schema types whose values are numbers. */
const NUMBER_FACT_TYPES = new Set(['integer', 'float']);

/** The plain operators that look inside a list fact. */
const LIST_FACT_OPERATORS = new Set(['contains', 'doesNotContain']);

/**
 * Whether ``types`` (every type the selected retrievers give a fact name)
 * are all ``incompatible``: retrievers may give one name different types, and
 * which one an entity's value comes from isn't known until it's evaluated.
 */
function everyType(
  types: unknown[] | undefined,
  incompatible: (type: unknown) => boolean,
): boolean {
  return !!types && types.length > 0 && types.every(incompatible);
}

/**
 * Number operators on a fact that isn't a number. json-rules-engine doesn't
 * throw for these: the condition is just false for every entity, so a rule
 * like `githubVisibility greaterThan 5` builds and evaluates but can never
 * pass. The same goes for `equal` with a list, which compares with `===`: it
 * never passes, and `notEqual` with a list never fails.
 *
 * Other plain operators on a list fact compare the whole list too: `equal` and
 * `in` never pass, while `notEqual` and `notIn` always do. A `path` reads one
 * item and a decorator like `someFact:equal` tests each item, so those are fine.
 */
function typeProblems(
  conditions: unknown,
  factTypes: Map<string, unknown[]>,
): CheckProblem[] {
  return leavesOf({ node: conditions, path: '/conditions' }).flatMap(leaf => {
    const {
      fact,
      operator,
      path: factPath,
      value,
    } = leaf.node as Record<string, unknown>;
    if (
      typeof fact === 'string' &&
      typeof operator === 'string' &&
      everyType(factTypes.get(fact), type => type === 'set') &&
      factPath === undefined &&
      !operator.includes(':') &&
      !LIST_FACT_OPERATORS.has(operator)
    ) {
      return [
        {
          code: 'invalid-rule' as const,
          path: `${leaf.path}/operator`,
          fact,
          message: `${fact} is a list, so ${operator} can't test what it holds; use contains or doesNotContain.`,
        },
      ];
    }
    if (
      typeof fact === 'string' &&
      Array.isArray(value) &&
      (operator === 'equal' || operator === 'notEqual')
    ) {
      return [
        {
          code: 'invalid-rule' as const,
          path: `${leaf.path}/operator`,
          fact,
          message: `${operator} compares one value, so it can't match a list; use ${
            operator === 'equal' ? 'in' : 'notIn'
          }.`,
        },
      ];
    }
    // A path reads a value inside the fact (e.g. a list's $.length), whose
    // type the fact schema doesn't give.
    if (
      typeof fact !== 'string' ||
      factPath !== undefined ||
      !NUMBER_OPERATORS.has(String(operator))
    ) {
      return [];
    }
    const types = factTypes.get(fact);
    if (
      !everyType(
        types,
        type => typeof type === 'string' && !NUMBER_FACT_TYPES.has(type),
      )
    ) {
      return [];
    }
    const type = [...new Set(types)].join(' or ');
    return [
      {
        code: 'invalid-rule' as const,
        path: `${leaf.path}/operator`,
        fact,
        message: `${operator} compares numbers, but ${fact} is a ${type}; use equal, notEqual, in or notIn.`,
      },
    ];
  });
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

  constructor(
    private readonly store: Pick<TechInsightsStore, 'getLatestSchemas'>,
  ) {}

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

    const kinds = kindProblems(check, schemas);
    const provided = new Set(
      schemas.flatMap(schema =>
        Object.keys(schema).filter(name => !SCHEMA_METADATA_KEYS.has(name)),
      ),
    );
    const unknownFacts = [
      ...new Set(factNamesIn(check.rule.conditions)),
    ].filter(name => !provided.has(name));
    if (unknownFacts.length === 0) {
      // Every type each fact name has across the selected retrievers.
      const factTypes = new Map<string, unknown[]>();
      for (const schema of schemas) {
        for (const [name, field] of Object.entries(schema)) {
          if (!SCHEMA_METADATA_KEYS.has(name)) {
            factTypes.set(name, [
              ...(factTypes.get(name) ?? []),
              (field as { type?: unknown } | null)?.type,
            ]);
          }
        }
      }
      return [...kinds, ...typeProblems(check.rule.conditions, factTypes)];
    }
    const unknown: CheckProblem[] = unknownFacts.map(name => {
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
    return [...kinds, ...unknown];
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
