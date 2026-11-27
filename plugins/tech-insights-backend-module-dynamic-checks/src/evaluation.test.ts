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
import {
  dryRunCheck,
  FACT_PREVIEW_LENGTH,
  type CheckEvaluation,
} from './dryRun';
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
    githubVisibility: { type: 'string', description: '' },
    githubDaysSinceLastPush: { type: 'integer', description: '' },
    githubTopics: { type: 'set', description: '' },
    shards: { type: 'set', description: '' },
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

describe('CheckValidator entity kinds', () => {
  const kindSchemas = [
    { id: 'components', entityFilter: [{ kind: 'component' }], a: {} },
    { id: 'apis', entityFilter: { kind: 'API' }, b: {} },
    { id: 'anything', c: {} },
  ];
  const validator = new CheckValidator({
    getLatestSchemas: async () => kindSchemas as any,
  });
  const reading = (
    factIds: string[],
    filter?: TechInsightJsonRuleCheck['filter'],
  ) => ({
    ...check('k', 'a'),
    factIds,
    rule: {
      conditions: {
        all: factIds.map(id => ({
          fact: { components: 'a', apis: 'b', anything: 'c' }[id]!,
          operator: 'equal',
          value: 1,
        })),
      },
    },
    ...(filter && { filter }),
  });

  it('reports retrievers with no kind in common', async () => {
    await expect(
      validator.problemsOf(reading(['components', 'apis'])),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'kind-mismatch',
        message: expect.stringContaining('any of the same entity kinds'),
      }),
    ]);
  });

  it("reports retrievers that miss every kind the check's filter allows", async () => {
    await expect(
      validator.problemsOf(reading(['apis'], { kind: 'Component' })),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'kind-mismatch',
        message: expect.stringContaining(
          "don't collect facts for Component, the kinds this check applies to",
        ),
      }),
    ]);
  });

  it('accepts a filter one of whose kinds the retrievers collect for', async () => {
    await expect(
      validator.problemsOf(
        reading(['components', 'anything'], { kind: ['component', 'System'] }),
      ),
    ).resolves.toEqual([]);
  });
});

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

  it('points at a number operator on a fact that is not a number', async () => {
    const problems = await validator.problemsOf({
      ...check('x', 'githubIsArchived'),
      rule: {
        conditions: {
          all: [
            {
              fact: 'githubDaysSinceLastPush',
              operator: 'lessThan',
              value: 90,
            },
            { fact: 'githubVisibility', operator: 'greaterThan', value: 5 },
          ],
        },
      },
    });
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'invalid-rule',
        path: '/conditions/all/1/operator',
        fact: 'githubVisibility',
      }),
    ]);
  });

  it.each([
    ['equal', 'in'],
    ['notEqual', 'notIn'],
  ])('points %s with a list at %s', async (operator, suggested) => {
    const problems = await validator.problemsOf({
      ...check('x', 'githubIsArchived'),
      rule: {
        conditions: {
          any: [{ fact: 'githubVisibility', operator, value: ['private'] }],
        },
      },
    });
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'invalid-rule',
        path: '/conditions/any/0/operator',
        fact: 'githubVisibility',
        message: expect.stringContaining(`use ${suggested}`),
      }),
    ]);
  });

  it('accepts in and notIn with a list', async () => {
    await expect(
      validator.problemsOf({
        ...check('x', 'githubIsArchived'),
        rule: {
          conditions: {
            all: [
              { fact: 'githubVisibility', operator: 'in', value: ['private'] },
              {
                fact: 'githubVisibility',
                operator: 'notIn',
                value: ['public'],
              },
            ],
          },
        },
      }),
    ).resolves.toEqual([]);
  });

  describe('list facts', () => {
    const problemsOfCondition = (condition: {
      operator: string;
      value: string | number | string[];
      path?: string;
    }) =>
      validator.problemsOf({
        ...check('x', 'githubIsArchived'),
        rule: {
          conditions: { all: [{ fact: 'githubTopics', ...condition }] },
        },
      });

    it.each([
      ['equal', 'security'],
      ['notEqual', 'security'],
      ['equal', ['security']],
      ['in', ['security']],
      ['notIn', ['security']],
      ['greaterThan', 1],
    ])('rejects %s with %j', async (operator, value) => {
      await expect(problemsOfCondition({ operator, value })).resolves.toEqual([
        expect.objectContaining({
          code: 'invalid-rule',
          path: '/conditions/all/0/operator',
          fact: 'githubTopics',
          message: expect.stringContaining('use contains or doesNotContain'),
        }),
      ]);
    });

    it.each([
      [{ operator: 'contains', value: 'security' }],
      [{ operator: 'doesNotContain', value: 'security' }],
      [{ operator: 'someFact:equal', value: 'security' }],
      [{ operator: 'everyFact:notEqual', value: 'security' }],
      [{ path: '$[0]', operator: 'equal', value: 'security' }],
      [{ path: '$.length', operator: 'greaterThan', value: 0 }],
    ])('accepts %j', async condition => {
      await expect(problemsOfCondition(condition)).resolves.toEqual([]);
    });
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

  describe('with a path into a list fact', () => {
    const pathCheck = (operator: string): TechInsightJsonRuleCheck => ({
      ...check('ignored', 'shards'),
      rule: {
        conditions: {
          all: [
            {
              fact: 'shards',
              path: '$[?(@.primary)].healthy',
              operator,
              value: true,
            },
          ],
        },
      },
    });

    it('shows what the path selected beside a preview of the fact', async () => {
      const shards = [
        { name: 'a', primary: true, healthy: true },
        { name: 'b', primary: true, healthy: false },
        { name: 'c', primary: false, healthy: true },
      ];
      const { evaluation } = createEvaluation(createStore({ shards }));

      const response = await dryRunCheck({
        check: pathCheck('everyFact:equal'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(response).toMatchObject({ status: 'failed', reasons: [] });
      const [leaf] = (response.conditions as { all: unknown[] }).all;
      expect(leaf).toEqual(
        expect.objectContaining({
          path: '$[?(@.primary)].healthy',
          factResult: [true, false],
          factPreview: JSON.stringify(shards),
          result: false,
        }),
      );
      expect(leaf).not.toHaveProperty('selectedNothing');
      expect(leaf).not.toHaveProperty('factPreviewTruncated');
      expect(leaf).not.toHaveProperty('factValue');
    });

    it('cuts the preview of a large fact', async () => {
      const shards = Array.from({ length: 50 }, (_, i) => ({
        name: `shard-${i}`,
        primary: true,
        healthy: true,
      }));
      const { evaluation } = createEvaluation(createStore({ shards }));

      const response = await dryRunCheck({
        check: pathCheck('everyFact:equal'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      const [leaf] = (response.conditions as { all: unknown[] }).all;
      expect(leaf).toEqual(
        expect.objectContaining({
          factPreview: JSON.stringify(shards).slice(0, FACT_PREVIEW_LENGTH),
          factPreviewTruncated: true,
        }),
      );
    });

    it('explains the fact values the check ran on', async () => {
      const stale = createStore({
        shards: [{ name: 'a', primary: true, healthy: true }],
      });
      const shards = [{ name: 'c', primary: false, healthy: true }];
      const fresh = createStore({ shards });
      const store = {
        ...fresh,
        getLatestFactsByIds: jest
          .fn()
          .mockImplementationOnce(stale.getLatestFactsByIds)
          .mockImplementation(fresh.getLatestFactsByIds),
      } as unknown as TechInsightsStore;
      const { evaluation } = createEvaluation(store);

      const response = await dryRunCheck({
        check: pathCheck('everyFact:equal'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(store.getLatestFactsByIds).toHaveBeenCalledTimes(2);
      expect(response.reasons).toEqual([
        expect.objectContaining({ code: 'empty-selection' }),
      ]);
      const [leaf] = (response.conditions as { all: unknown[] }).all;
      expect(leaf).toEqual(
        expect.objectContaining({
          selectedNothing: true,
          factPreview: JSON.stringify(shards),
        }),
      );
    });

    it('says when the path selected nothing', async () => {
      const shards = [{ name: 'c', primary: false, healthy: true }];
      const { evaluation } = createEvaluation(createStore({ shards }));

      const response = await dryRunCheck({
        check: pathCheck('everyFact:equal'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(response).toMatchObject({
        status: 'failed',
        reasons: [
          {
            code: 'empty-selection',
            message: `The path "$[?(@.primary)].healthy" selected nothing from shards for ${ENTITY_REF}, so its condition had no value to compare and failed because nothing was selected.`,
          },
        ],
      });
      const [leaf] = (response.conditions as { all: unknown[] }).all;
      expect(leaf).toEqual(
        expect.objectContaining({
          selectedNothing: true,
          factPreview: JSON.stringify(shards),
        }),
      );
      expect(leaf).not.toHaveProperty('factResult');
    });

    it('says a negated list operator passed only because nothing was selected', async () => {
      const shards = [{ name: 'c', primary: false, healthy: true }];
      const { evaluation } = createEvaluation(createStore({ shards }));

      const response = await dryRunCheck({
        check: pathCheck('not:everyFact:equal'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(response).toMatchObject({
        status: 'passed',
        reasons: [
          {
            code: 'empty-selection',
            message: `The path "$[?(@.primary)].healthy" selected nothing from shards for ${ENTITY_REF}, so its condition had no value to compare and passed only because nothing was selected.`,
          },
        ],
      });
    });

    it('explains a path condition nested in any and not', async () => {
      const shards = [
        { name: 'a', primary: true, healthy: false },
        { name: 'c', primary: false, healthy: true },
      ];
      const { evaluation } = createEvaluation(createStore({ shards }));
      const leaf = {
        fact: 'shards',
        path: '$[?(@.primary)].healthy',
        operator: 'someFact:equal',
        value: false,
      };

      const response = await dryRunCheck({
        check: {
          ...check('ignored', 'shards'),
          rule: { conditions: { any: [{ not: leaf }] } },
        },
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(response).toMatchObject({ status: 'failed', reasons: [] });
      const nested = response.conditions as {
        any: Array<{ not: Record<string, unknown> }>;
      };
      expect(nested.any[0].not).toEqual(
        expect.objectContaining({
          ...leaf,
          factResult: [false],
          factPreview: JSON.stringify(shards),
          result: true,
        }),
      );
    });

    describe('under a not', () => {
      const negatedCheck = (
        operator: string,
        wrap: (leaf: unknown) => unknown = leaf => ({ not: leaf }),
      ): TechInsightJsonRuleCheck => ({
        ...check('ignored', 'shards'),
        rule: {
          conditions: wrap({
            fact: 'shards',
            path: '$[?(@.primary)].healthy',
            operator,
            value: true,
          }) as TechInsightJsonRuleCheck['rule']['conditions'],
        },
      });

      it.each([
        [
          'a list operator',
          'everyFact:equal',
          undefined,
          'passed',
          'passed only because',
        ],
        [
          'a negated list operator',
          'not:everyFact:equal',
          undefined,
          'failed',
          'failed because',
        ],
        [
          'two nots',
          'everyFact:equal',
          (leaf: unknown) => ({ not: { not: leaf } }),
          'failed',
          'failed because',
        ],
        [
          'a not inside all and any',
          'everyFact:equal',
          (leaf: unknown) => ({ all: [{ any: [{ not: leaf }] }] }),
          'passed',
          'passed only because',
        ],
      ])(
        'names the outcome of %s that selected nothing',
        async (_label, operator, wrap, status, consequence) => {
          const shards = [{ name: 'c', primary: false, healthy: true }];
          const { evaluation } = createEvaluation(createStore({ shards }));

          const response = await dryRunCheck({
            check: negatedCheck(operator, wrap),
            entity,
            entityRef: ENTITY_REF,
            evaluation,
          });

          expect(response).toMatchObject({
            status,
            reasons: [
              {
                code: 'empty-selection',
                message: `The path "$[?(@.primary)].healthy" selected nothing from shards for ${ENTITY_REF}, so its condition had no value to compare and ${consequence} nothing was selected.`,
              },
            ],
          });
        },
      );

      it.each([
        ['passes', [{ name: 'a', primary: true, healthy: false }], 'passed'],
        ['fails', [{ name: 'a', primary: true, healthy: true }], 'failed'],
      ])(
        'reports no empty selection when what it selected %s',
        async (_label, shards, status) => {
          const { evaluation } = createEvaluation(createStore({ shards }));

          const response = await dryRunCheck({
            check: negatedCheck('everyFact:equal'),
            entity,
            entityRef: ENTITY_REF,
            evaluation,
          });

          expect(response).toMatchObject({ status, reasons: [] });
          const { not: leaf } = response.conditions as {
            not: Record<string, unknown>;
          };
          expect(leaf).toEqual(
            expect.objectContaining({
              factResult: shards.map(s => s.healthy),
              factPreview: JSON.stringify(shards),
            }),
          );
          expect(leaf).not.toHaveProperty('selectedNothing');
        },
      );
    });

    it('names no outcome for an operator that does not need a list', async () => {
      const { evaluation } = createEvaluation(createStore({ shards: [] }));

      const response = await dryRunCheck({
        check: pathCheck('notEqual'),
        entity,
        entityRef: ENTITY_REF,
        evaluation,
      });

      expect(response.reasons).toEqual([
        expect.objectContaining({
          code: 'empty-selection',
          message: expect.stringMatching(/had no value to compare\.$/),
        }),
      ]);
    });
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
