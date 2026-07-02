import { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';
import { ConfigReader } from '@backstage/config';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import { RtdToTemplateConverter } from '../converters/RtdToTemplateConverter';
import { PtdToTemplateConverter } from '../converters/PtdToTemplateConverter';
import { EventDeltaApplier } from './EventDeltaApplier';

// ---------------------------------------------------------------------------
// API client mock — every call returns 404 so we exercise the dispatch +
// removal path without needing valid resource fixtures or running the
// translators. The tests assert which entity-ref is removed for each kind,
// which proves the right private method was reached.
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
}));

function notFound() {
  return {
    data: undefined,
    error: undefined,
    response: { ok: false, status: 404 },
  };
}

function mkLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as any;
}

function newApplier(connection: EntityProviderConnection) {
  return new EventDeltaApplier({
    logger: mkLogger(),
    baseUrl: 'http://test:8080',
    defaultOwner: 'group:default/test-owner',
    translatorContext: {
      providerName: 'OpenChoreoEntityProvider',
      defaultOwner: 'group:default/test-owner',
      componentTypeUtils: ComponentTypeUtils.fromConfig(
        new ConfigReader({ openchoreo: { componentTypes: { mappings: [] } } }),
      ),
    },
    getConnection: () => connection,
    ctdConverter: new CtdToTemplateConverter(mkLogger()),
    rtdConverter: new RtdToTemplateConverter(mkLogger()),
    ptdConverter: new PtdToTemplateConverter(mkLogger()),
  });
}

describe('EventDeltaApplier.handleEvent', () => {
  let applyMutation: jest.Mock;
  let connection: EntityProviderConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGET.mockResolvedValue(notFound());
    applyMutation = jest.fn();
    connection = { applyMutation, refresh: jest.fn() } as any;
  });

  // Each row: kind from the event payload → expected removed entityRef when
  // the resource is missing in the API. The mapping is the contract between
  // the event-forwarder's CRD names and Backstage's entity kinds, and
  // exercises the dispatch table in handleEvent end-to-end.
  const namespacedCases: Array<{
    kind: string;
    expectedRefs: string[];
  }> = [
    { kind: 'Project', expectedRefs: ['system:test-ns/order'] },
    { kind: 'Component', expectedRefs: ['component:test-ns/order'] },
    // Workload deletion has a dedicated dispatch path (catalog query +
    // convention fallback); covered by separate tests below, not by
    // the generic per-kind dispatch table.
    { kind: 'Environment', expectedRefs: ['environment:test-ns/order'] },
    {
      kind: 'ObservabilityAlertsNotificationChannel',
      expectedRefs: ['observabilityalertsnotificationchannel:test-ns/order'],
    },
    { kind: 'DataPlane', expectedRefs: ['dataplane:test-ns/order'] },
    { kind: 'WorkflowPlane', expectedRefs: ['workflowplane:test-ns/order'] },
    {
      kind: 'ObservabilityPlane',
      expectedRefs: ['observabilityplane:test-ns/order'],
    },
    {
      kind: 'DeploymentPipeline',
      expectedRefs: ['deploymentpipeline:test-ns/order'],
    },
    {
      kind: 'ComponentType',
      expectedRefs: [
        'componenttype:test-ns/order',
        'template:test-ns/template-order',
      ],
    },
    { kind: 'Trait', expectedRefs: ['traittype:test-ns/order'] },
    {
      kind: 'ResourceType',
      expectedRefs: [
        'resourcetype:test-ns/order',
        'template:test-ns/template-resource-order',
      ],
    },
    {
      kind: 'ProjectType',
      expectedRefs: [
        'projecttype:test-ns/order',
        'template:test-ns/template-project-order',
      ],
    },
    { kind: 'Resource', expectedRefs: ['resource:test-ns/order'] },
    { kind: 'Workflow', expectedRefs: ['workflow:test-ns/order'] },
  ];

  it.each(namespacedCases)(
    'routes "$kind" to a removal mutation against the right entity refs',
    async ({ kind, expectedRefs }) => {
      const applier = newApplier(connection);

      await applier.handleEvent(kind, 'order', 'test-ns', 'deleted');

      expect(applyMutation).toHaveBeenCalledTimes(1);
      const call = applyMutation.mock.calls[0][0];
      expect(call.type).toBe('delta');
      expect(call.added).toEqual([]);
      expect(call.removed.map((r: any) => r.entityRef).sort()).toEqual(
        [...expectedRefs].sort(),
      );
      // locationKey ties the mutation back to this provider so the catalog
      // engine knows which subscriber's entries to evict.
      for (const r of call.removed) {
        expect(r.locationKey).toBe('provider:OpenChoreoEntityProvider');
      }
    },
  );

  // Cluster-scoped kinds project to the synthetic `openchoreo-cluster`
  // namespace because Backstage entities must have a namespace, but the
  // underlying CRs do not.
  const clusterCases: Array<{
    kind: string;
    expectedRefs: string[];
  }> = [
    {
      kind: 'ClusterComponentType',
      expectedRefs: [
        'clustercomponenttype:openchoreo-cluster/global',
        'template:openchoreo-cluster/template-global',
      ],
    },
    {
      kind: 'ClusterResourceType',
      expectedRefs: [
        'clusterresourcetype:openchoreo-cluster/global',
        'template:openchoreo-cluster/template-resource-global',
      ],
    },
    {
      kind: 'ClusterProjectType',
      expectedRefs: [
        'clusterprojecttype:openchoreo-cluster/global',
        'template:openchoreo-cluster/template-project-global',
      ],
    },
    {
      kind: 'ClusterTrait',
      expectedRefs: ['clustertraittype:openchoreo-cluster/global'],
    },
    {
      kind: 'ClusterWorkflow',
      expectedRefs: ['clusterworkflow:openchoreo-cluster/global'],
    },
    {
      kind: 'ClusterDataPlane',
      expectedRefs: ['clusterdataplane:openchoreo-cluster/global'],
    },
    {
      kind: 'ClusterObservabilityPlane',
      expectedRefs: ['clusterobservabilityplane:openchoreo-cluster/global'],
    },
    {
      kind: 'ClusterWorkflowPlane',
      expectedRefs: ['clusterworkflowplane:openchoreo-cluster/global'],
    },
  ];

  it.each(clusterCases)(
    'routes cluster-scoped "$kind" to refs in the openchoreo-cluster namespace',
    async ({ kind, expectedRefs }) => {
      const applier = newApplier(connection);

      // Cluster-scoped events arrive with no namespace; handleEvent must
      // not let that turn into "default".
      await applier.handleEvent(kind, 'global', undefined, 'deleted');

      expect(applyMutation).toHaveBeenCalledTimes(1);
      const refs = applyMutation.mock.calls[0][0].removed.map(
        (r: any) => r.entityRef,
      );
      expect(refs.sort()).toEqual([...expectedRefs].sort());
    },
  );

  it('upserts the ProjectType entity and its generated project template on a create event', async () => {
    mockGET.mockImplementation((path: string) => {
      if (path.endsWith('/projecttypes/{ptName}')) {
        return Promise.resolve(
          okData({
            metadata: {
              name: 'web-app',
              namespace: 'test-ns',
              creationTimestamp: '2026-06-01T10:00:00Z',
              annotations: {
                'openchoreo.dev/display-name': 'Web Application',
              },
            },
            spec: {
              parameters: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: { replicas: { type: 'integer' } },
                },
              },
              resources: [],
            },
          }),
        );
      }
      return Promise.resolve(notFound());
    });

    const applier = newApplier(connection);
    await applier.handleEvent('ProjectType', 'web-app', 'test-ns', 'created');

    expect(applyMutation).toHaveBeenCalledTimes(1);
    const call = applyMutation.mock.calls[0][0];
    expect(call.removed).toEqual([]);
    const added = call.added.map((a: any) => a.entity);
    expect(
      added.find((e: any) => e.kind === 'ProjectType')?.metadata.name,
    ).toBe('web-app');
    const tmpl = added.find(
      (e: any) =>
        e.kind === 'Template' && e.metadata.name === 'template-project-web-app',
    );
    expect(tmpl).toBeDefined();
    expect(tmpl.metadata.namespace).toBe('test-ns');
    expect(tmpl.spec.type).toBe('Project');
    // Schema from the type round-trips into the wizard's parameters field.
    expect(
      tmpl.spec.parameters[1].properties.parameters['ui:options'].ptdSchema
        .properties.replicas.type,
    ).toBe('integer');
  });

  it('upserts the ClusterProjectType entity and its generated project template on a create event', async () => {
    mockGET.mockImplementation((path: string) => {
      if (path.endsWith('/clusterprojecttypes/{cptName}')) {
        return Promise.resolve(
          okData({
            metadata: {
              name: 'standard',
              creationTimestamp: '2026-06-01T10:00:00Z',
            },
            spec: {
              parameters: {
                openAPIV3Schema: { type: 'object', properties: {} },
              },
              resources: [],
            },
          }),
        );
      }
      return Promise.resolve(notFound());
    });

    const applier = newApplier(connection);
    await applier.handleEvent(
      'ClusterProjectType',
      'standard',
      undefined,
      'updated',
    );

    const call = applyMutation.mock.calls[0][0];
    const added = call.added.map((a: any) => a.entity);
    expect(
      added.find((e: any) => e.kind === 'ClusterProjectType')?.metadata.name,
    ).toBe('standard');
    const tmpl = added.find(
      (e: any) =>
        e.kind === 'Template' &&
        e.metadata.name === 'template-project-standard',
    );
    expect(tmpl).toBeDefined();
    expect(tmpl.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('routes Namespace events to a Domain entity in the "default" namespace', async () => {
    const applier = newApplier(connection);

    // Namespaces are cluster-scoped; the event payload's namespace field is
    // empty and the K8s namespace name is in `name`.
    await applier.handleEvent('Namespace', 'my-org', undefined, 'deleted');

    const refs = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(refs).toEqual(['domain:default/my-org']);
  });

  it('falls back to the "default" namespace when the event omits one', async () => {
    const applier = newApplier(connection);

    await applier.handleEvent('Project', 'order', undefined, 'deleted');

    const refs = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(refs).toEqual(['system:default/order']);
  });

  it('logs and ignores unknown kinds without calling applyMutation', async () => {
    const logger = mkLogger();
    const applier = new EventDeltaApplier({
      logger,
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(logger),
      rtdConverter: new RtdToTemplateConverter(logger),
      ptdConverter: new PtdToTemplateConverter(logger),
    });

    await applier.handleEvent('NotARealKind', 'foo', 'ns', 'created');

    expect(applyMutation).not.toHaveBeenCalled();
    expect(mockGET).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown OpenChoreo event kind "NotARealKind"'),
    );
  });

  it('is no-op when there is no provider connection yet', async () => {
    const applier = new EventDeltaApplier({
      logger: mkLogger(),
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      // Simulates the race where an event arrives between subscribe() and
      // connect() — fetch happens, but the eventual removal mutation has
      // nowhere to go and must silently drop instead of throwing.
      getConnection: () => undefined,
      ctdConverter: new CtdToTemplateConverter(mkLogger()),
      rtdConverter: new RtdToTemplateConverter(mkLogger()),
      ptdConverter: new PtdToTemplateConverter(mkLogger()),
    });

    await expect(
      applier.handleEvent('Project', 'order', 'test-ns', 'deleted'),
    ).resolves.toBeUndefined();
  });

  it('is case-insensitive on the kind field', async () => {
    const applier = newApplier(connection);

    await applier.handleEvent('PROJECT', 'order', 'test-ns', 'deleted');
    await applier.handleEvent('project', 'order2', 'test-ns', 'deleted');
    await applier.handleEvent('PrOjEcT', 'order3', 'test-ns', 'deleted');

    expect(applyMutation).toHaveBeenCalledTimes(3);
  });

  // ---- Workload create/update path -----------------------------------
  // Workload events are special: the event payload's `name` is the
  // workload's own metadata.name, but the Backstage entity that needs
  // refreshing is the *Component* identified by spec.owner.componentName.
  // These tests cover the lookup-by-name + dispatch flow.

  function okData<T>(data: T) {
    return {
      data,
      error: undefined,
      response: { ok: true, status: 200 },
    };
  }

  it('routes a workload create event to the component named in spec.owner.componentName', async () => {
    // Pretend the workload-by-name fetch returns a real Workload owned
    // by component "real-component", which differs from the workload's
    // own name "order-service-workload". The component-by-name fetch
    // then 404s (default mock) so we can observe the resulting removal
    // mutation hitting `component:test-ns/real-component`, proving the
    // dispatch went to the right component.
    mockGET.mockImplementation((path: string) => {
      if (path.endsWith('/workloads/{workloadName}')) {
        return Promise.resolve(
          okData({
            metadata: {
              name: 'order-service-workload',
              namespace: 'test-ns',
            },
            spec: { owner: { componentName: 'real-component' } },
          }),
        );
      }
      return Promise.resolve(notFound());
    });

    const applier = newApplier(connection);
    await applier.handleEvent(
      'Workload',
      'order-service-workload',
      'test-ns',
      'created',
    );

    expect(applyMutation).toHaveBeenCalledTimes(1);
    const refs = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(refs).toEqual(['component:test-ns/real-component']);
  });

  it('filters consumesApis down to deps whose target endpoints expose a schema', async () => {
    // Component "consumer" has a Workload with two dependencies:
    //   - producer/http   → target endpoint exposes a schema → keep
    //   - producer/metrics → schemaless target endpoint     → drop
    // The dispatcher should fetch the producer's workload exactly once
    // (cache) and only include the schemaful dep in consumesApis. This
    // is the regression guard for the "Some related entities could not
    // be found" UI warning that fired when refs pointed at API entities
    // that don't exist.
    const consumerWorkload = {
      metadata: { name: 'consumer-workload', namespace: 'test-ns' },
      spec: {
        owner: { componentName: 'consumer', projectName: 'p' },
        dependencies: {
          endpoints: [
            // Same-project (no `project` set on the dep)
            { component: 'producer', name: 'http' },
            { component: 'producer', name: 'metrics' },
          ],
        },
      },
    };
    const consumerComponent = {
      metadata: {
        name: 'consumer',
        namespace: 'test-ns',
        // Explicit owner annotation skips the project-fetch path that
        // would otherwise complicate this test.
        annotations: { 'backstage.io/owner': 'group:default/owner' },
      },
      spec: { owner: { projectName: 'p' } },
    };
    const producerWorkload = {
      metadata: { name: 'producer-workload', namespace: 'test-ns' },
      spec: {
        owner: { componentName: 'producer', projectName: 'p' },
        endpoints: {
          http: {
            type: 'REST',
            port: 8080,
            schema: { type: 'openapi', content: 'openapi: 3.0.0\n...' },
          },
          metrics: { type: 'HTTP', port: 9100 }, // no schema
        },
      },
    };

    let producerWorkloadFetches = 0;
    mockGET.mockImplementation((path: string, options?: any) => {
      // 1. Workload-by-name fetch resolves the consumer.
      if (
        path === '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}'
      ) {
        return Promise.resolve(okData(consumerWorkload));
      }
      // 2. Component fetch for the resolved consumer.
      if (
        path === '/api/v1/namespaces/{namespaceName}/components/{componentName}'
      ) {
        return Promise.resolve(okData(consumerComponent));
      }
      // 3. List-workloads-by-component, filtered by ?component=...
      if (path === '/api/v1/namespaces/{namespaceName}/workloads') {
        const target = options?.params?.query?.component;
        if (target === 'consumer') {
          return Promise.resolve(okData({ items: [consumerWorkload] }));
        }
        if (target === 'producer') {
          producerWorkloadFetches += 1;
          return Promise.resolve(okData({ items: [producerWorkload] }));
        }
        return Promise.resolve(okData({ items: [] }));
      }
      return Promise.resolve(notFound());
    });

    const applier = newApplier(connection);
    await applier.handleEvent(
      'Workload',
      'consumer-workload',
      'test-ns',
      'created',
    );

    // Cache check: two deps to the same target component → one fetch.
    expect(producerWorkloadFetches).toBe(1);

    // Exactly one upsert mutation for the consumer + its API entities.
    expect(applyMutation).toHaveBeenCalledTimes(1);
    const added = applyMutation.mock.calls[0][0].added.map(
      (a: any) => a.entity,
    );
    const component = added.find((e: any) => e.kind === 'Component');
    expect(component).toBeDefined();

    // The schemaful dep is preserved; the schemaless one is dropped.
    expect(component.spec.consumesApis).toEqual(['p-producer-http']);
    expect(component.spec.consumesApis).not.toContain('p-producer-metrics');
  });

  it('falls back to the openchoreo.dev/component label when spec.owner.componentName is missing', async () => {
    mockGET.mockImplementation((path: string) => {
      if (path.endsWith('/workloads/{workloadName}')) {
        return Promise.resolve(
          okData({
            metadata: {
              name: 'wl-name',
              namespace: 'test-ns',
              labels: { 'openchoreo.dev/component': 'labelled-component' },
            },
            spec: {}, // no owner
          }),
        );
      }
      return Promise.resolve(notFound());
    });

    const applier = newApplier(connection);
    await applier.handleEvent('Workload', 'wl-name', 'test-ns', 'updated');

    const refs = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(refs).toEqual(['component:test-ns/labelled-component']);
  });

  it('logs a warning and does nothing when a workload create event references no component', async () => {
    mockGET.mockImplementation((path: string) => {
      if (path.endsWith('/workloads/{workloadName}')) {
        return Promise.resolve(
          okData({
            metadata: { name: 'orphan', namespace: 'test-ns' },
            spec: {}, // no owner, no label either
          }),
        );
      }
      return Promise.resolve(notFound());
    });

    const logger = mkLogger();
    const applier = new EventDeltaApplier({
      logger,
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(logger),
      rtdConverter: new RtdToTemplateConverter(logger),
      ptdConverter: new PtdToTemplateConverter(logger),
    });

    await applier.handleEvent('Workload', 'orphan', 'test-ns', 'created');

    expect(applyMutation).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot link to a component'),
    );
  });

  it('defers to full sync when a workload create event races a delete (404 on fetch)', async () => {
    // Default mock: every fetch (including workloads-by-name) returns 404.
    const logger = mkLogger();
    const applier = new EventDeltaApplier({
      logger,
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(logger),
      rtdConverter: new RtdToTemplateConverter(logger),
      ptdConverter: new PtdToTemplateConverter(logger),
    });

    await applier.handleEvent('Workload', 'gone', 'test-ns', 'created');

    expect(applyMutation).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found at fetch time'),
    );
  });

  // ---- Workload deletion path ---------------------------------------
  // Workload deletion uses a catalog annotation query: every
  // Component/API we emit on create/update carries
  // `openchoreo.io/workload=<workloadName>`, so on delete we look up
  // those entities directly and act on what we find. No fetch of the
  // (now-gone) workload is needed.

  function makeCatalogService(items: any[]) {
    return {
      getEntities: jest.fn(async () => ({ items })),
    } as any;
  }

  function makeAuth() {
    return {
      getOwnServiceCredentials: jest.fn(async () => ({})),
    } as any;
  }

  function newApplierWithCatalog(catalogService: any, auth: any = makeAuth()) {
    return new EventDeltaApplier({
      logger: mkLogger(),
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(mkLogger()),
      rtdConverter: new RtdToTemplateConverter(mkLogger()),
      ptdConverter: new PtdToTemplateConverter(mkLogger()),
      catalogService,
      auth,
    });
  }

  it('removes annotated API entities and refreshes the parent Component on workload delete', async () => {
    // Catalog query returns the parent Component plus two derived API
    // entities, all annotated with the deleted workload's name.
    const matchedItems = [
      {
        kind: 'Component',
        metadata: { namespace: 'test-ns', name: 'order-service' },
      },
      {
        kind: 'API',
        metadata: { namespace: 'test-ns', name: 'order-svc-http' },
      },
      {
        kind: 'API',
        metadata: { namespace: 'test-ns', name: 'order-svc-grpc' },
      },
    ];
    const catalogService = makeCatalogService(matchedItems);
    const applier = newApplierWithCatalog(catalogService);

    await applier.handleEvent(
      'Workload',
      'order-service-workload',
      'test-ns',
      'deleted',
    );

    // Catalog was queried with the workload-name annotation filter.
    expect(catalogService.getEntities).toHaveBeenCalledTimes(1);
    expect(catalogService.getEntities.mock.calls[0][0].filter).toMatchObject({
      'metadata.annotations.openchoreo.io/workload': 'order-service-workload',
    });

    // Two mutations applied:
    //   - removeEntityRefs for both API entities
    //   - refreshComponent for the parent → fetch fails (default 404
    //     mock) → triggers removal of `component:test-ns/order-service`
    // We expect 2 distinct mutation calls. The first removes the APIs,
    // the second is the component-removal triggered by the 404 in
    // refreshComponent.
    expect(applyMutation).toHaveBeenCalledTimes(2);

    const removedFirst = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(removedFirst.sort()).toEqual([
      'api:test-ns/order-svc-grpc',
      'api:test-ns/order-svc-http',
    ]);

    const removedSecond = applyMutation.mock.calls[1][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(removedSecond).toEqual(['component:test-ns/order-service']);
  });

  it('logs and defers to full sync when the catalog has no entities for the deleted workload', async () => {
    // Cold-start race: catalog hasn't seen this workload yet.
    const catalogService = makeCatalogService([]);
    const logger = mkLogger();
    const applier = new EventDeltaApplier({
      logger,
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(logger),
      rtdConverter: new RtdToTemplateConverter(logger),
      ptdConverter: new PtdToTemplateConverter(logger),
      catalogService,
      auth: makeAuth(),
    });

    await applier.handleEvent('Workload', 'unannotated', 'test-ns', 'deleted');

    expect(applyMutation).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'no annotated entities in catalog yet (cold-start race)',
      ),
    );
  });

  it('removes only API entities when no parent Component is in the result set', async () => {
    // Edge case: APIs were upserted but the Component annotation didn't
    // get applied yet, OR the component itself was deleted concurrently.
    const matchedItems = [
      {
        kind: 'API',
        metadata: { namespace: 'test-ns', name: 'orphan-http' },
      },
    ];
    const catalogService = makeCatalogService(matchedItems);
    const applier = newApplierWithCatalog(catalogService);

    await applier.handleEvent(
      'Workload',
      'orphan-workload',
      'test-ns',
      'deleted',
    );

    expect(applyMutation).toHaveBeenCalledTimes(1);
    const refs = applyMutation.mock.calls[0][0].removed.map(
      (r: any) => r.entityRef,
    );
    expect(refs).toEqual(['api:test-ns/orphan-http']);
  });

  it('logs and skips when no CatalogService is wired (test mode)', async () => {
    const logger = mkLogger();
    const applier = new EventDeltaApplier({
      logger,
      baseUrl: 'http://test:8080',
      defaultOwner: 'group:default/test-owner',
      translatorContext: {
        providerName: 'OpenChoreoEntityProvider',
        defaultOwner: 'group:default/test-owner',
        componentTypeUtils: ComponentTypeUtils.fromConfig(
          new ConfigReader({
            openchoreo: { componentTypes: { mappings: [] } },
          }),
        ),
      },
      getConnection: () => connection,
      ctdConverter: new CtdToTemplateConverter(logger),
      rtdConverter: new RtdToTemplateConverter(logger),
      ptdConverter: new PtdToTemplateConverter(logger),
      // No catalogService / auth — production always wires them, but
      // tests/legacy callers may not.
    });

    await applier.handleEvent(
      'Workload',
      'order-service-workload',
      'test-ns',
      'deleted',
    );

    expect(applyMutation).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no CatalogService is wired'),
    );
  });
});
