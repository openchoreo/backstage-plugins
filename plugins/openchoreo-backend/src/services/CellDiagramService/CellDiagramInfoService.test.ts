import { mockServices } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { createOkResponse } from '@openchoreo/test-utils';
import { CellDiagramInfoService } from './CellDiagramInfoService';

const mockGET = jest.fn();
const mockObsPOST = jest.fn();
const mockResolveForEnvironment = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  createObservabilityClientWithUrl: jest.fn(() => ({
    POST: mockObsPOST,
  })),
  ObservabilityUrlResolver: jest.fn().mockImplementation(() => ({
    resolveForEnvironment: mockResolveForEnvironment,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

const mockLogger = mockServices.logger.mock();
const config = new ConfigReader({});

function createService() {
  return new CellDiagramInfoService(mockLogger, 'http://test:8080', config);
}

const k8sComponent = (name: string, componentType: string) => ({
  metadata: {
    name,
    namespace: 'test-ns',
    uid: `uid-${name}`,
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {},
  },
  spec: {
    owner: { projectName: 'my-project' },
    componentType: { kind: 'ComponentType', name: componentType },
  },
  status: { conditions: [] },
});

const k8sWorkload = (
  componentName: string,
  opts?: {
    endpoints?: Record<string, any>;
    dependencies?: any;
  },
) => ({
  metadata: { name: `${componentName}-workload`, namespace: 'test-ns' },
  spec: {
    owner: { projectName: 'my-project', componentName },
    ...(opts?.endpoints && { endpoints: opts.endpoints }),
    ...(opts?.dependencies && { dependencies: opts.dependencies }),
  },
  status: {},
});

describe('CellDiagramInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProjectInfo', () => {
    it('returns project with components and correct types', async () => {
      // First fetchAllPages call: components
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            k8sComponent('api-svc', 'deployment/service'),
            k8sComponent('web-ui', 'deployment/web-app'),
            k8sComponent('cron-job', 'cronjob/cleanup'),
          ],
          pagination: {},
        }),
      );
      // Second fetchAllPages call: workloads
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );
      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('my-project');
      expect(result!.components).toHaveLength(3);

      const apiSvc = result!.components.find(c => c.id === 'api-svc');
      expect(apiSvc!.type).toBe('service');

      const webUi = result!.components.find(c => c.id === 'web-ui');
      expect(webUi!.type).toBe('web-app');

      const cronJob = result!.components.find(c => c.id === 'cron-job');
      expect(cronJob!.type).toBe('scheduled-task');
    });

    it('excludes job/* components from diagram', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            k8sComponent('migration', 'job/db-migrate'),
            k8sComponent('api', 'deployment/service'),
          ],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'proj', namespaceName: 'ns' },
        'token',
      );

      expect(result!.components).toHaveLength(1);
      expect(result!.components[0].id).toBe('api');
    });

    it('returns undefined when no components found', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'proj', namespaceName: 'ns' },
        'token',
      );

      expect(result).toBeUndefined();
    });

    it('returns undefined on API error', async () => {
      // The service uses manual error checking (not assertApiResponse),
      // so the error is thrown inside fetchAllPages. The service's try/catch
      // catches it and returns undefined.
      mockGET.mockResolvedValueOnce({
        data: undefined,
        error: { message: 'fail' },
        response: {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        },
      });
      // Second call for workloads (may or may not be reached due to Promise.all)
      mockGET.mockResolvedValueOnce({
        data: undefined,
        error: { message: 'fail' },
        response: {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        },
      });

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'proj', namespaceName: 'ns' },
        'token',
      );

      expect(result).toBeUndefined();
    });

    it('builds connections from workload dependencies', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            k8sComponent('frontend', 'deployment/web-app'),
            k8sComponent('backend', 'deployment/service'),
          ],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            k8sWorkload('frontend', {
              dependencies: {
                endpoints: [
                  { name: 'api', component: 'backend', project: 'my-project' },
                ],
              },
            }),
          ],
          pagination: {},
        }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token',
      );

      const frontend = result!.components.find(c => c.id === 'frontend');
      expect(frontend!.connections).toHaveLength(1);
      expect(frontend!.connections![0].onPlatform).toBe(true);
      expect(frontend!.connections![0].label).toBe('backend/api');
    });

    it('maps workload endpoints to services with gateway visibility', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sComponent('api', 'deployment/service')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            k8sWorkload('api', {
              endpoints: {
                http: {
                  type: 'HTTP',
                  visibility: ['external', 'internal'],
                },
              },
            }),
          ],
          pagination: {},
        }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token',
      );

      const api = result!.components.find(c => c.id === 'api');
      const httpService = (api!.services as any).http;
      expect(httpService.type).toBe('HTTP');
      expect(httpService.deploymentMetadata.gateways.internet.isExposed).toBe(
        true,
      );
      expect(httpService.deploymentMetadata.gateways.intranet.isExposed).toBe(
        true,
      );
    });

    it('renders proxy/* components as api-proxy type', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sComponent('my-proxy', 'proxy/http')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token',
      );

      expect(result!.components).toHaveLength(1);
      expect(result!.components[0].type).toBe('api-proxy');
    });

    it('attaches gateway observations when observability is available (Phase 1)', async () => {
      mockGET
        // components
        .mockResolvedValueOnce(
          createOkResponse({
            items: [k8sComponent('api', 'deployment/service')],
            pagination: {},
          }),
        )
        // workloads
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sWorkload('api', {
                endpoints: {
                  http: { type: 'HTTP', visibility: ['external'] },
                },
              }),
            ],
            pagination: {},
          }),
        );
      // resources

      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });

      // Phase 1: HTTP metrics query returns traffic
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({
          requestCount: [{ timestamp: 1, value: 5 }],
          unsuccessfulRequestCount: [{ timestamp: 1, value: 1 }],
          meanLatency: [{ timestamp: 1, value: 0.01 }],
          latencyP50: [{ timestamp: 1, value: 0.005 }],
          latencyP90: [{ timestamp: 1, value: 0.02 }],
          latencyP99: [{ timestamp: 1, value: 0.05 }],
        }),
      );
      // Phase 2: runtime topology returns no edges
      mockObsPOST.mockResolvedValueOnce(createOkResponse({ edges: [] }));

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
          startTime: new Date(Date.now() - 3600_000).toISOString(),
          endTime: new Date().toISOString(),
        },
        'token',
      );

      expect(result).toBeDefined();
      const api = result!.components.find(c => c.id === 'api');
      const httpSvc = (api!.services as any).http;
      expect(
        httpSvc.deploymentMetadata.gateways.internet.observations,
      ).toBeDefined();
      expect(
        httpSvc.deploymentMetadata.gateways.internet.observations[0]
          .requestCount,
      ).toBeGreaterThan(0);
    });

    it('attaches connection observations from runtime topology (Phase 2)', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sComponent('frontend', 'deployment/web-app'),
              k8sComponent('backend', 'deployment/service'),
            ],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sWorkload('frontend', {
                dependencies: {
                  endpoints: [
                    {
                      name: 'api',
                      component: 'backend',
                      project: 'my-project',
                    },
                  ],
                },
              }),
            ],
            pagination: {},
          }),
        );

      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });

      // Phase 1: no traffic for either component
      mockObsPOST
        .mockResolvedValueOnce(createOkResponse({ requestCount: [] }))
        .mockResolvedValueOnce(createOkResponse({ requestCount: [] }));

      // Phase 2: runtime topology returns a component->component edge
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({
          edges: [
            {
              source: {
                kind: 'component',
                component: 'frontend',
                componentUid: 'uid-frontend',
              },
              target: {
                kind: 'component',
                component: 'backend',
                componentUid: 'uid-backend',
              },
              metrics: {
                requestCount: 42,
                unsuccessfulRequestCount: 2,
                meanLatency: 0.01,
                latencyP50: 0.005,
                latencyP90: 0.02,
                latencyP99: 0.05,
              },
            },
          ],
        }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token',
      );

      const frontend = result!.components.find(c => c.id === 'frontend');
      const conn = frontend!.connections?.find(c =>
        (c.id ?? '').includes('backend'),
      );
      expect(conn).toBeDefined();
      expect((conn as any).observations?.[0].requestCount).toBe(42);
    });

    it('adds runtime-only connection when no static connection matches', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sComponent('svc-a', 'deployment/service'),
              k8sComponent('svc-b', 'deployment/service'),
            ],
            pagination: {},
          }),
        )
        // no workload dependencies
        .mockResolvedValueOnce(createOkResponse({ items: [], pagination: {} }));

      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });

      // Phase 1: no traffic
      mockObsPOST
        .mockResolvedValueOnce(createOkResponse({ requestCount: [] }))
        .mockResolvedValueOnce(createOkResponse({ requestCount: [] }));

      // Phase 2: runtime topology has an edge with no static match
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({
          edges: [
            {
              source: { kind: 'component', component: 'svc-a' },
              target: { kind: 'component', component: 'svc-b' },
              metrics: {
                requestCount: 10,
                unsuccessfulRequestCount: 0,
                meanLatency: 0.001,
              },
            },
          ],
        }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token',
      );

      const svcA = result!.components.find(c => c.id === 'svc-a');
      const runtimeConn = svcA!.connections?.find(
        c => (c as any).observationOnly === true,
      );
      expect(runtimeConn).toBeDefined();
      expect((runtimeConn as any).observations?.[0].requestCount).toBe(10);
    });

    it('skips Phase 2 gracefully when runtime-topology returns 404', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [k8sComponent('api', 'deployment/service')],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(createOkResponse({ items: [], pagination: {} }));

      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });

      // Phase 1: no traffic
      mockObsPOST.mockResolvedValueOnce(createOkResponse({ requestCount: [] }));

      // Phase 2: 404 from older observer
      mockObsPOST.mockResolvedValueOnce({
        data: undefined,
        error: { message: 'not found' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token',
      );

      expect(result).toBeDefined();
      expect(result!.components).toHaveLength(1);
    });

    it('skips enrichment when observer URL is not available', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [k8sComponent('api', 'deployment/service')],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(createOkResponse({ items: [], pagination: {} }));

      mockResolveForEnvironment.mockResolvedValueOnce({ observerUrl: null });

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token',
      );

      expect(result).toBeDefined();
      expect(mockObsPOST).not.toHaveBeenCalled();
    });

    it('skips non-component edges in runtime topology', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [k8sComponent('api', 'deployment/service')],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(createOkResponse({ items: [], pagination: {} }));

      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });

      // Phase 1
      mockObsPOST.mockResolvedValueOnce(createOkResponse({ requestCount: [] }));

      // Phase 2: edge with gateway kind (should be skipped)
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({
          edges: [
            {
              source: { kind: 'gateway', component: 'gw' },
              target: { kind: 'component', component: 'api' },
              metrics: { requestCount: 5 },
            },
          ],
        }),
      );

      const service = createService();
      const result = await service.fetchProjectInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token',
      );

      expect(result).toBeDefined();
      const api = result!.components.find(c => c.id === 'api');
      expect(api!.connections).toHaveLength(0);
    });

    it('emits Datastore connections from workload.dependencies.resources', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [k8sComponent('api', 'deployment/service')],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sWorkload('api', {
                dependencies: {
                  resources: [
                    { ref: 'orders-db', envBindings: { host: 'DB_HOST' } },
                    { ref: 'orders-cache' },
                  ],
                },
              }),
            ],
            pagination: {},
          }),
        );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token',
      );

      const api = result!.components.find(c => c.id === 'api');
      expect(api!.connections).toHaveLength(2);

      const dbConn = api!.connections!.find(c => c.label === 'orders-db');
      expect(dbConn).toBeDefined();
      expect(dbConn!.type).toBe('datastore');
      expect(dbConn!.onPlatform).toBe(true);
      // The cell-diagram lib's getConnectionMetadata splits on `:` and
      // requires 3 or 4 tokens; a malformed id silently disables the edge.
      expect(dbConn!.id).toBe('test-ns:my-project:orders-db:resource');
      expect(dbConn!.id.split(':')).toHaveLength(4);

      const cacheConn = api!.connections!.find(c => c.label === 'orders-cache');
      expect(cacheConn).toBeDefined();
      expect(cacheConn!.type).toBe('datastore');
    });

    it('emits endpoint and resource connections side by side', async () => {
      mockGET
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sComponent('api', 'deployment/service'),
              k8sComponent('reports', 'deployment/service'),
            ],
            pagination: {},
          }),
        )
        .mockResolvedValueOnce(
          createOkResponse({
            items: [
              k8sWorkload('api', {
                dependencies: {
                  endpoints: [
                    {
                      name: 'http',
                      component: 'reports',
                      project: 'my-project',
                    },
                  ],
                  resources: [{ ref: 'orders-db' }],
                },
              }),
            ],
            pagination: {},
          }),
        );

      const service = createService();
      const result = await service.fetchProjectInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token',
      );

      const api = result!.components.find(c => c.id === 'api');
      expect(api!.connections).toHaveLength(2);
      expect(api!.connections!.some(c => c.type === 'http')).toBe(true);
      expect(api!.connections!.some(c => c.type === 'datastore')).toBe(true);
    });
  });
});
