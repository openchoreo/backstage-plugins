import { mockServices } from '@backstage/backend-test-utils';
import type { Entity } from '@backstage/catalog-model';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import {
  JsonRulesEngineFactCheckerFactory,
  type TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';
import {
  EvaluableCheckRegistry,
  StaticCheckRegistry,
} from './EvaluableCheckRegistry';
import { dryRunCheck, type CheckEvaluation } from './dryRun';
import { CheckValidator } from './validation';

const ENTITY_REF = 'component:default/greeter';
const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'greeter', namespace: 'default' },
};

const schemas = [
  {
    id: 'githubRepositoryFactRetriever',
    version: '0.1.0',
    entityFilter: [{ kind: 'component' }],
    githubIsArchived: { type: 'boolean', description: '' },
  },
] as unknown as Array<Record<string, unknown> & { id: string }>;

function createStore(facts: Record<string, unknown>): TechInsightsStore {
  return {
    getLatestSchemas: jest.fn(async (ids?: string[]) =>
      ids ? schemas.filter(s => ids.includes(s.id)) : schemas,
    ),
    getLatestFactsByIds: jest.fn(async (ids: string[]) =>
      ids.includes('githubRepositoryFactRetriever')
        ? {
            githubRepositoryFactRetriever: {
              id: 'githubRepositoryFactRetriever',
              entity: {
                namespace: 'default',
                kind: 'Component',
                name: 'greeter',
              },
              timestamp: { toISO: () => '2026-10-27T00:00:00.000Z' },
              version: '0.1.0',
              facts,
            },
          }
        : {},
    ),
  } as unknown as TechInsightsStore;
}

function check(
  id: string,
  fact: string,
  value: unknown = false,
): TechInsightJsonRuleCheck {
  return {
    id,
    type: 'json-rules-engine',
    name: id,
    description: '',
    factIds: ['githubRepositoryFactRetriever'],
    metadata: {},
    rule: { conditions: { all: [{ fact, operator: 'equal', value }] } },
  };
}

function createEvaluation(store: TechInsightsStore) {
  const logger = mockServices.logger.mock();
  const checkerOver = (
    checkRegistry: ConstructorParameters<
      typeof JsonRulesEngineFactCheckerFactory
    >[0]['checkRegistry'],
  ) =>
    new JsonRulesEngineFactCheckerFactory({
      checks: [],
      logger,
      checkRegistry,
    }).construct(store);
  const validator = new CheckValidator(store);
  const evaluation: CheckEvaluation = {
    store,
    validator,
    checkerFor: checks => checkerOver(new StaticCheckRegistry(checks)),
  };
  return { evaluation, validator, checkerOver, logger };
}

describe('CheckValidator', () => {
  const { validator } = createEvaluation(createStore({}));

  it('accepts a check whose facts its retrievers define', async () => {
    await expect(
      validator.problemsOf(check('ok', 'githubIsArchived')),
    ).resolves.toEqual([]);
  });

  it('reports an unknown retriever', async () => {
    await expect(
      validator.problemsOf({
        ...check('x', 'githubIsArchived'),
        factIds: ['noSuchRetriever'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'unknown-retriever',
        factRetrieverId: 'noSuchRetriever',
      }),
    ]);
  });

  it('reports a fact no retriever defines', async () => {
    await expect(
      validator.problemsOf(check('x', 'githubNoSuchFact')),
    ).resolves.toEqual([expect.objectContaining({ code: 'unknown-fact' })]);
  });

  it('reads the schemas once for a whole set of checks', async () => {
    const store = createStore({});
    const { validator: own } = createEvaluation(store);
    const checks = Array.from({ length: 30 }, (_, i) =>
      check(`c${i}`, i % 2 ? 'githubIsArchived' : 'githubNoSuchFact'),
    );

    const problems = await own.problemsOfEach(checks);

    expect(store.getLatestSchemas).toHaveBeenCalledTimes(1);
    expect(problems.map(p => p.map(problem => problem.code))).toEqual(
      checks.map((_, i) => (i % 2 ? [] : ['unknown-fact'])),
    );
  });

  it.each([
    [
      'an operator json-rules-engine lacks',
      { fact: 'githubIsArchived', operator: 'equals', value: true },
    ],
    [
      'a condition without a value',
      { fact: 'githubIsArchived', operator: 'equal' },
    ],
    ['a reference to a named condition', { condition: 'shared' }],
  ])('reports %s', async (_label, leaf) => {
    const invalid = {
      ...check('x', 'githubIsArchived'),
      rule: {
        conditions: {
          all: [
            { fact: 'githubIsArchived', operator: 'equal', value: true },
            leaf,
          ],
        },
      },
    } as unknown as TechInsightJsonRuleCheck;
    await expect(validator.problemsOf(invalid)).resolves.toEqual([
      expect.objectContaining({ code: 'invalid-rule' }),
    ]);
  });

  it.each([
    [
      'the operator that is unknown',
      {
        all: [
          { fact: 'githubIsArchived', operator: 'equal', value: true },
          {
            any: [
              { fact: 'githubIsArchived', operator: 'equal', value: true },
              {
                not: { fact: 'githubIsArchived', operator: 'equals', value: 1 },
              },
            ],
          },
        ],
      },
      ['/conditions/all/1/any/1/not/operator'],
    ],
    [
      'every leaf that fails, not only the first',
      {
        any: [
          { fact: 'githubIsArchived', operator: 'equals', value: true },
          { fact: 'githubIsArchived', operator: 'equal', value: true },
          { fact: 'githubIsArchived', operator: 'isTrue', value: true },
        ],
      },
      ['/conditions/any/0/operator', '/conditions/any/2/operator'],
    ],
    [
      'a reference to a named condition jsonfc does not define',
      { all: [{ condition: 'shared' }] },
      ['/conditions/all/0/condition'],
    ],
    [
      'a condition missing its value',
      { all: [{ any: [{ fact: 'githubIsArchived', operator: 'equal' }] }] },
      ['/conditions/all/0/any/0'],
    ],
    [
      'an all that is not an array',
      { all: [{ all: { fact: 'githubIsArchived' } }] },
      ['/conditions/all/0'],
    ],
    [
      'a root that is a bare condition',
      { fact: 'githubIsArchived', operator: 'equal', value: true },
      ['/conditions'],
    ],
  ])('points at %s', async (_label, conditions, paths) => {
    const problems = await validator.problemsOf({
      ...check('x', 'githubIsArchived'),
      rule: { conditions } as unknown as TechInsightJsonRuleCheck['rule'],
    });
    expect(problems.map(p => [p.code, p.path])).toEqual(
      paths.map(path => ['invalid-rule', path]),
    );
  });

  it('names the unknown fact', async () => {
    await expect(
      validator.problemsOf(check('x', 'githubNoSuchFact')),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'unknown-fact',
        fact: 'githubNoSuchFact',
      }),
    ]);
  });

  it.each([
    ['a rule that is not an object', []],
    ['a rule without conditions', {}],
  ])('reports %s at the rule itself', async (_label, rule) => {
    await expect(
      validator.problemsOf({
        ...check('x', 'githubIsArchived'),
        rule: rule as unknown as TechInsightJsonRuleCheck['rule'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({ code: 'invalid-rule', path: '' }),
    ]);
  });

  it('accepts a rule that uses not', async () => {
    await expect(
      validator.problemsOf({
        ...check('x', 'githubIsArchived'),
        rule: {
          conditions: {
            all: [
              {
                not: {
                  fact: 'githubIsArchived',
                  operator: 'equal',
                  value: true,
                },
              },
            ],
          },
        },
      }),
    ).resolves.toEqual([]);
  });
});

describe('EvaluableCheckRegistry', () => {
  it('keeps one broken published check from failing the others', async () => {
    const store = createStore({ githubIsArchived: false });
    const { validator, checkerOver, logger } = createEvaluation(store);
    const published = [
      check('not-archived', 'githubIsArchived'),
      check('broken', 'githubNoSuchFact'),
    ];
    const registry = {
      list: jest.fn().mockResolvedValue(published),
      getAllPublished: jest.fn().mockResolvedValue(published),
    } as unknown as DynamicCheckRegistry;
    const checker = checkerOver(
      new EvaluableCheckRegistry(registry, validator, logger),
    );

    const results = await checker.runChecks(ENTITY_REF);

    expect(results.map(r => [r.check.id, r.result])).toEqual([
      ['not-archived', true],
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    await checker.runChecks(ENTITY_REF);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('evaluates explicitly requested checks only when published', async () => {
    const store = createStore({ githubIsArchived: false });
    const { validator, checkerOver, logger } = createEvaluation(store);
    const registry = {
      getAllPublished: jest.fn().mockResolvedValue([]),
    } as unknown as DynamicCheckRegistry;
    const checker = checkerOver(
      new EvaluableCheckRegistry(registry, validator, logger),
    );

    await expect(checker.runChecks(ENTITY_REF, ['draft-1'])).resolves.toEqual(
      [],
    );
    expect(registry.getAllPublished).toHaveBeenCalledWith(['draft-1']);
  });
});

describe('dryRunCheck', () => {
  it('evaluates the draft with the same checker and stores nothing', async () => {
    const store = createStore({ githubIsArchived: true });
    const { evaluation } = createEvaluation(store);
    const draft = check('ignored', 'githubIsArchived');

    await expect(
      dryRunCheck({
        check: draft,
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('fails a draft on a null fact, the value of an unresolved entity', async () => {
    const store = createStore({ githubIsArchived: null });
    const { evaluation } = createEvaluation(store);

    await expect(
      dryRunCheck({
        check: check('ignored', 'githubIsArchived'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('reports a draft that cannot be evaluated as invalid', async () => {
    const { evaluation } = createEvaluation(createStore({}));

    await expect(
      dryRunCheck({
        check: check('ignored', 'githubNoSuchFact'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'invalid',
        reasons: [expect.objectContaining({ code: 'unknown-fact' })],
      }),
    );
  });
});
