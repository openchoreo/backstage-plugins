import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import {
  stringifyEntityRef,
  type CompoundEntityRef,
  type Entity,
} from '@backstage/catalog-model';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { TechInsightsStore } from '@backstage-community/plugin-tech-insights-node';
import {
  JsonRulesEngineFactCheckerFactory,
  type TechInsightJsonRuleCheck,
} from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import { StaticCheckRegistry } from './EvaluableCheckRegistry';
import { dryRunCheck, type CheckEvaluation } from './dryRun';
import {
  createFilterViewOf,
  readInheritedChecks,
  withFilterViews,
  type InheritedChecks,
} from './filterView';
import { CheckValidator } from './validation';

const RETRIEVER = 'openchoreoDeploymentFactRetriever';
const COMPONENT_REF = 'component:default/hello';
const LINE_REF = 'releaseline:default/next';
const RELEASE_LINES: InheritedChecks[] = [
  { kind: 'ReleaseLine', parentField: 'spec.component' },
];
const REQUEST = { credentials: mockCredentials.service() };

const component: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'hello', namespace: 'default' },
  spec: { type: 'service', owner: 'group:default/team' },
};
const line: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ReleaseLine',
  metadata: { name: 'next', namespace: 'default', title: 'hello:next' },
  spec: { component: COMPONENT_REF, owner: 'group:default/team' },
};

const schemas = [
  {
    id: RETRIEVER,
    version: '0.1.0',
    entityFilter: [{ kind: 'component' }, { kind: 'releaseline' }],
    openchoreoImagePinned: { type: 'boolean', description: '' },
  },
];

/** The component's image is pinned and the line's isn't. */
const pinnedByRef: Record<string, boolean> = {
  [COMPONENT_REF]: true,
  [LINE_REF]: false,
};

function createStore(): TechInsightsStore {
  return {
    getLatestSchemas: jest.fn(async () => schemas),
    getLatestFactsByIds: jest.fn(async (ids: string[], entityRef: string) =>
      ids.includes(RETRIEVER) && entityRef in pinnedByRef
        ? {
            [RETRIEVER]: {
              id: RETRIEVER,
              entity: entityRef,
              timestamp: { toISO: () => '2026-11-19T00:00:00.000Z' },
              version: '0.1.0',
              facts: { openchoreoImagePinned: pinnedByRef[entityRef] },
            },
          }
        : {},
    ),
  } as unknown as TechInsightsStore;
}

function createCatalog(entities: Entity[]) {
  const byRef = new Map(
    entities.map(entity => [stringifyEntityRef(entity), entity]),
  );
  const getEntityByRef = jest.fn(async (ref: string | CompoundEntityRef) =>
    byRef.get(typeof ref === 'string' ? ref : stringifyEntityRef(ref)),
  );
  const getEntities = jest.fn(async () => ({ items: entities }));
  return {
    catalog: { getEntityByRef, getEntities } as unknown as CatalogService,
    getEntityByRef,
    getEntities,
  };
}

function pinnedCheck(
  filter: TechInsightJsonRuleCheck['filter'],
): TechInsightJsonRuleCheck {
  return {
    id: 'image-pinned',
    type: 'json-rules-engine',
    name: 'Image is pinned',
    description: '',
    factIds: [RETRIEVER],
    filter,
    metadata: {},
    rule: {
      conditions: {
        all: [
          { fact: 'openchoreoImagePinned', operator: 'equal', value: true },
        ],
      },
    },
  };
}

function createChecker(options: {
  catalog: CatalogService;
  inheritedChecks: InheritedChecks[];
  store?: TechInsightsStore;
}) {
  const logger = mockServices.logger.mock();
  const store = options.store ?? createStore();
  const filterViewOf = createFilterViewOf({
    catalog: options.catalog,
    inheritedChecks: options.inheritedChecks,
    logger,
  });
  const checkerFor = (checks: TechInsightJsonRuleCheck[]) =>
    new JsonRulesEngineFactCheckerFactory({
      checks: [],
      logger,
      checkRegistry: new StaticCheckRegistry(checks),
      catalog: withFilterViews(options.catalog, filterViewOf),
      auth: mockServices.auth(),
    }).construct(store);
  return { checkerFor, filterViewOf, store, logger };
}

async function resultsOn(
  entityRef: string,
  check: TechInsightJsonRuleCheck,
  options: Parameters<typeof createChecker>[0],
) {
  const { checkerFor } = createChecker(options);
  const results = await checkerFor([check]).runChecks(entityRef);
  return results.map(r => [r.check.id, r.result]);
}

describe('inherited checks through jsonfc', () => {
  const { catalog } = createCatalog([component, line]);

  it("runs a component's check on its release line, against the line's facts", async () => {
    const store = createStore();
    const { checkerFor } = createChecker({
      catalog,
      inheritedChecks: RELEASE_LINES,
      store,
    });
    const checker = checkerFor([pinnedCheck({ kind: 'Component' })]);

    const onLine = await checker.runChecks(LINE_REF);
    const onComponent = await checker.runChecks(COMPONENT_REF);

    expect(onLine.map(r => [r.check.id, r.result])).toEqual([
      ['image-pinned', false],
    ]);
    expect(onComponent.map(r => [r.check.id, r.result])).toEqual([
      ['image-pinned', true],
    ]);
    expect(store.getLatestFactsByIds).toHaveBeenCalledWith(
      [RETRIEVER],
      LINE_REF,
    );
    expect(onLine[0].facts).toEqual({
      openchoreoImagePinned: expect.objectContaining({ value: false }),
    });
  });

  it.each([
    ["the component's type", { 'spec.type': 'service' }],
    ["the component's name", { 'metadata.name': 'hello' }],
    ["the line's own kind", { kind: 'ReleaseLine' }],
    ["the line's own name", { 'metadata.name': 'next' }],
  ])('matches a filter on %s', async (_label, filter) => {
    await expect(
      resultsOn(LINE_REF, pinnedCheck(filter), {
        catalog,
        inheritedChecks: RELEASE_LINES,
      }),
    ).resolves.toEqual([['image-pinned', false]]);
  });

  it("doesn't match a filter the component doesn't match", async () => {
    await expect(
      resultsOn(LINE_REF, pinnedCheck({ 'spec.type': 'web-application' }), {
        catalog,
        inheritedChecks: RELEASE_LINES,
      }),
    ).resolves.toEqual([]);
  });

  it("runs only the line's own checks when its component is missing", async () => {
    const { catalog: withoutComponent } = createCatalog([line]);
    const options = {
      catalog: withoutComponent,
      inheritedChecks: RELEASE_LINES,
    };

    await expect(
      resultsOn(LINE_REF, pinnedCheck({ kind: 'Component' }), options),
    ).resolves.toEqual([]);
    await expect(
      resultsOn(LINE_REF, pinnedCheck({ kind: 'ReleaseLine' }), options),
    ).resolves.toEqual([['image-pinned', false]]);
  });

  it('falls back to the line itself when reading its component fails', async () => {
    const getEntityByRef = jest.fn(async (ref: unknown) => {
      if (ref === LINE_REF) return line;
      throw new Error('catalog unavailable');
    });
    const failing = { getEntityByRef } as unknown as CatalogService;
    const { checkerFor, logger } = createChecker({
      catalog: failing,
      inheritedChecks: RELEASE_LINES,
    });

    await expect(
      checkerFor([pinnedCheck({ kind: 'Component' })]).runChecks(LINE_REF),
    ).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(COMPONENT_REF),
    );
  });

  it("doesn't change anything when no kind inherits checks", async () => {
    await expect(
      resultsOn(LINE_REF, pinnedCheck({ kind: 'Component' }), {
        catalog,
        inheritedChecks: [],
      }),
    ).resolves.toEqual([]);
  });
});

describe('createFilterViewOf', () => {
  it('reads the parent with the same request options', async () => {
    const { catalog, getEntityByRef } = createCatalog([component, line]);
    const filterViewOf = createFilterViewOf({
      catalog,
      inheritedChecks: RELEASE_LINES,
      logger: mockServices.logger.mock(),
    });
    const view = await filterViewOf(line, REQUEST);

    expect(getEntityByRef).toHaveBeenCalledWith(
      { kind: 'component', namespace: 'default', name: 'hello' },
      REQUEST,
    );
    expect(view.kind).toEqual(['Component', 'ReleaseLine']);
    expect(view.metadata.name).toEqual(['hello', 'next']);
    expect(view.spec).toEqual(component.spec);
  });

  it("resolves a parent ref without a namespace in the entity's namespace", async () => {
    const { catalog, getEntityByRef } = createCatalog([]);
    const filterViewOf = createFilterViewOf({
      catalog,
      inheritedChecks: RELEASE_LINES,
      logger: mockServices.logger.mock(),
    });

    await filterViewOf(
      {
        ...line,
        metadata: { ...line.metadata, namespace: 'team-a' },
        spec: { component: 'component:hello' },
      },
      REQUEST,
    );

    expect(getEntityByRef).toHaveBeenCalledWith(
      { kind: 'component', namespace: 'team-a', name: 'hello' },
      REQUEST,
    );
  });

  it('leaves other kinds alone without reading the catalog', async () => {
    const { catalog, getEntityByRef } = createCatalog([component]);
    const filterViewOf = createFilterViewOf({
      catalog,
      inheritedChecks: RELEASE_LINES,
      logger: mockServices.logger.mock(),
    });

    await expect(filterViewOf(component, REQUEST)).resolves.toBe(component);
    expect(getEntityByRef).not.toHaveBeenCalled();
  });
});

describe('withFilterViews', () => {
  it('passes every other catalog method to the catalog', async () => {
    const { catalog, getEntities } = createCatalog([component]);
    const wrapped = withFilterViews(catalog, async entity => entity);

    await wrapped.getEntities({}, REQUEST);

    expect(getEntities).toHaveBeenCalledTimes(1);
  });
});

describe('readInheritedChecks', () => {
  it('reads the inheriting kinds', () => {
    const config = mockServices.rootConfig({
      data: {
        techInsights: {
          dynamicChecks: {
            inheritChecks: [
              { kind: 'ReleaseLine', parentField: 'spec.component' },
            ],
          },
        },
      },
    });
    expect(readInheritedChecks(config)).toEqual(RELEASE_LINES);
  });

  it('reads none when the option is off', () => {
    expect(readInheritedChecks(mockServices.rootConfig())).toEqual([]);
  });
});

describe('dry run on a release line', () => {
  function createEvaluation(catalog: CatalogService) {
    const { checkerFor, filterViewOf, store } = createChecker({
      catalog,
      inheritedChecks: RELEASE_LINES,
    });
    const evaluation: CheckEvaluation = {
      store,
      validator: new CheckValidator(store),
      checkerFor,
    };
    return { evaluation, filterViewOf };
  }

  it('agrees with the published result', async () => {
    const { catalog } = createCatalog([component, line]);
    const { evaluation, filterViewOf } = createEvaluation(catalog);

    await expect(
      dryRunCheck({
        check: pinnedCheck({ kind: 'Component' }),
        entity: line,
        filterEntity: await filterViewOf(line, REQUEST),
        entityRef: LINE_REF,
        evaluation,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('explains a filter mismatch against the view and coverage against the line', async () => {
    const { catalog } = createCatalog([component, line]);
    const { evaluation, filterViewOf } = createEvaluation(catalog);
    const filterEntity = await filterViewOf(line, REQUEST);
    jest
      .mocked(evaluation.store.getLatestSchemas)
      .mockResolvedValue([
        { ...schemas[0], entityFilter: [{ kind: 'component' }] },
      ] as unknown as Awaited<
        ReturnType<TechInsightsStore['getLatestSchemas']>
      >);

    const filtered = await dryRunCheck({
      check: pinnedCheck({ 'spec.type': 'web-application' }),
      entity: line,
      filterEntity,
      entityRef: LINE_REF,
      evaluation,
    });
    expect(filtered.reasons).toEqual([
      expect.objectContaining({
        code: 'entity-filtered',
        message: expect.stringContaining('spec.type "service"'),
      }),
    ]);

    jest.mocked(evaluation.store.getLatestFactsByIds).mockResolvedValue({});
    const uncovered = await dryRunCheck({
      check: pinnedCheck({ kind: 'Component' }),
      entity: line,
      filterEntity,
      entityRef: LINE_REF,
      evaluation,
    });
    expect(uncovered.reasons).toEqual([
      expect.objectContaining({ code: 'retriever-not-covering' }),
    ]);
  });
});
