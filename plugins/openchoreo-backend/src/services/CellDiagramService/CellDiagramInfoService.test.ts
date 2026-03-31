import { mockServices } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { createOkResponse } from '@openchoreo/test-utils';
import { CellDiagramInfoService } from './CellDiagramInfoService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  fetchAllPages: jest.fn(
    (fetchPage: (cursor?: string) => Promise<any>) =>
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

const k8sWorkload = (componentName: string, opts?: {
  endpoints?: Record<string, any>;
  dependencies?: any;
}) => ({
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
        response: { ok: false, status: 500, statusText: 'Internal Server Error' },
      });
      // Second call for workloads (may or may not be reached due to Promise.all)
      mockGET.mockResolvedValueOnce({
        data: undefined,
        error: { message: 'fail' },
        response: { ok: false, status: 500, statusText: 'Internal Server Error' },
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
      expect(
        httpService.deploymentMetadata.gateways.internet.isExposed,
      ).toBe(true);
      expect(
        httpService.deploymentMetadata.gateways.intranet.isExposed,
      ).toBe(true);
    });
  });
});
