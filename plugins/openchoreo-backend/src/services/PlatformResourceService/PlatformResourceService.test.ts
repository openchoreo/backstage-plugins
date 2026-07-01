import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { PlatformResourceService } from './PlatformResourceService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPUT = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: mockPUT,
    DELETE: mockDELETE,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const k8sEnvironment = {
  metadata: {
    name: 'dev',
    namespace: 'test-ns',
  },
  spec: {
    dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
    isProduction: false,
  },
  status: { conditions: [] },
};

const k8sWorkflow = {
  metadata: {
    name: 'docker-build',
    namespace: 'test-ns',
  },
  spec: {
    type: 'Build',
  },
  status: { conditions: [] },
};

const k8sNotificationChannel = {
  metadata: {
    name: 'dev-webhook',
    namespace: 'test-ns',
  },
  spec: {
    environment: 'dev',
    type: 'webhook',
    webhookConfig: { url: 'https://hooks.example.com' },
  },
  status: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new PlatformResourceService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlatformResourceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceDefinition', () => {
    it('fetches environment via new API', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sEnvironment));

      const service = createService();
      const result = await service.getResourceDefinition(
        'environments' as any,
        'test-ns',
        'dev',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(k8sEnvironment);
    });

    it('fetches workflow via new API', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sWorkflow));

      const service = createService();
      const result = await service.getResourceDefinition(
        'workflows' as any,
        'test-ns',
        'docker-build',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(k8sWorkflow);
    });

    it('fetches dataplane via new API', async () => {
      const dp = { metadata: { name: 'dp-1' }, spec: {} };
      mockGET.mockResolvedValueOnce(createOkResponse(dp));

      const service = createService();
      const result = await service.getResourceDefinition(
        'dataplanes' as any,
        'test-ns',
        'dp-1',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(dp);
    });

    it('fetches deploymentpipeline via new API', async () => {
      const pipeline = { metadata: { name: 'default' }, spec: {} };
      mockGET.mockResolvedValueOnce(createOkResponse(pipeline));

      const service = createService();
      const result = await service.getResourceDefinition(
        'deploymentpipelines' as any,
        'test-ns',
        'default',
        'token-123',
      );

      expect(result.success).toBe(true);
    });

    it('fetches clusterresourcetype via new API', async () => {
      const crt = {
        metadata: { name: 'mysql' },
        spec: { retainPolicy: 'Retain' },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(crt));

      const service = createService();
      const result = await service.getResourceDefinition(
        'clusterresourcetypes' as any,
        '',
        'mysql',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(crt);
    });

    it('fetches resourcetype via new API', async () => {
      const rt = {
        metadata: { name: 'postgres', namespace: 'test-ns' },
        spec: { retainPolicy: 'Retain' },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(rt));

      const service = createService();
      const result = await service.getResourceDefinition(
        'resourcetypes' as any,
        'test-ns',
        'postgres',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(rt);
    });

    it('fetches projecttype via new API', async () => {
      const pt = {
        metadata: { name: 'standard-project', namespace: 'test-ns' },
        spec: { resources: [] },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(pt));

      const service = createService();
      const result = await service.getResourceDefinition(
        'projecttypes' as any,
        'test-ns',
        'standard-project',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(pt);
    });

    it('fetches clusterprojecttype via new API', async () => {
      const cpt = {
        metadata: { name: 'global-project' },
        spec: { resources: [] },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(cpt));

      const service = createService();
      const result = await service.getResourceDefinition(
        'clusterprojecttypes' as any,
        '',
        'global-project',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cpt);
    });

    it('fetches resource via new API', async () => {
      const resource = {
        metadata: { name: 'analytics-db', namespace: 'test-ns' },
        spec: {
          owner: { projectName: 'my-project' },
          type: { kind: 'ResourceType', name: 'postgres' },
        },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(resource));

      const service = createService();
      const result = await service.getResourceDefinition(
        'resources' as any,
        'test-ns',
        'analytics-db',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(resource);
    });

    it('fetches observabilityalertsnotificationchannel via new API', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sNotificationChannel));

      const service = createService();
      const result = await service.getResourceDefinition(
        'observabilityalertsnotificationchannels' as any,
        'test-ns',
        'dev-webhook',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(k8sNotificationChannel);
      expect(mockGET).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels/{observabilityAlertsNotificationChannelName}',
        expect.objectContaining({
          params: {
            path: {
              namespaceName: 'test-ns',
              observabilityAlertsNotificationChannelName: 'dev-webhook',
            },
          },
        }),
      );
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.getResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('updateResourceDefinition', () => {
    it('updates environment via new API PUT', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sEnvironment));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'environments' as any,
        'test-ns',
        'dev',
        k8sEnvironment,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.operation).toBe('updated');
      expect(result.data?.name).toBe('dev');
      expect(result.data?.kind).toBe('Environment');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates workflow via new API PUT', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sWorkflow));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'workflows' as any,
        'test-ns',
        'docker-build',
        k8sWorkflow,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('Workflow');
    });

    it('updates clusterresourcetype via new API PUT', async () => {
      const crt = {
        metadata: { name: 'mysql' },
        spec: { retainPolicy: 'Retain' },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(crt));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'clusterresourcetypes' as any,
        '',
        'mysql',
        crt,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ClusterResourceType');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates resourcetype via new API PUT', async () => {
      const rt = {
        metadata: { name: 'postgres', namespace: 'test-ns' },
        spec: { retainPolicy: 'Retain' },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(rt));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'resourcetypes' as any,
        'test-ns',
        'postgres',
        rt,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ResourceType');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates resource via new API PUT', async () => {
      const resource = {
        metadata: { name: 'analytics-db', namespace: 'test-ns' },
        spec: {
          owner: { projectName: 'my-project' },
          type: { kind: 'ResourceType', name: 'postgres' },
        },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(resource));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'resources' as any,
        'test-ns',
        'analytics-db',
        resource,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('Resource');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates projecttype via new API PUT', async () => {
      const pt = {
        metadata: { name: 'standard-project', namespace: 'test-ns' },
        spec: { resources: [] },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(pt));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'projecttypes' as any,
        'test-ns',
        'standard-project',
        pt,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ProjectType');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates clusterprojecttype via new API PUT', async () => {
      const cpt = {
        metadata: { name: 'global-project' },
        spec: { resources: [] },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(cpt));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'clusterprojecttypes' as any,
        '',
        'global-project',
        cpt,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ClusterProjectType');
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('updates observabilityalertsnotificationchannel via new API PUT', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sNotificationChannel));

      const service = createService();
      const result = await service.updateResourceDefinition(
        'observabilityalertsnotificationchannels' as any,
        'test-ns',
        'dev-webhook',
        k8sNotificationChannel,
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.operation).toBe('updated');
      expect(result.data?.name).toBe('dev-webhook');
      expect(result.data?.kind).toBe('ObservabilityAlertsNotificationChannel');
      expect(mockPUT).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels/{observabilityAlertsNotificationChannelName}',
        expect.objectContaining({
          params: {
            path: {
              namespaceName: 'test-ns',
              observabilityAlertsNotificationChannelName: 'dev-webhook',
            },
          },
        }),
      );
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.updateResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          k8sEnvironment,
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('deleteResourceDefinition', () => {
    it('deletes environment via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'environments' as any,
        'test-ns',
        'dev',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.operation).toBe('deleted');
      expect(result.data?.kind).toBe('Environment');
      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('deletes workflowplane via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'workflowplanes' as any,
        'test-ns',
        'bp-1',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('WorkflowPlane');
    });

    it('deletes clusterresourcetype via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'clusterresourcetypes' as any,
        '',
        'mysql',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ClusterResourceType');
    });

    it('deletes resourcetype via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'resourcetypes' as any,
        'test-ns',
        'postgres',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ResourceType');
    });

    it('deletes resource via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'resources' as any,
        'test-ns',
        'analytics-db',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('Resource');
    });

    it('deletes projecttype via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'projecttypes' as any,
        'test-ns',
        'standard-project',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ProjectType');
    });

    it('deletes clusterprojecttype via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'clusterprojecttypes' as any,
        '',
        'global-project',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ClusterProjectType');
    });

    it('deletes observabilityalertsnotificationchannel via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      const result = await service.deleteResourceDefinition(
        'observabilityalertsnotificationchannels' as any,
        'test-ns',
        'dev-webhook',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('ObservabilityAlertsNotificationChannel');
      expect(mockDELETE).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels/{observabilityAlertsNotificationChannelName}',
        expect.objectContaining({
          params: {
            path: {
              namespaceName: 'test-ns',
              observabilityAlertsNotificationChannelName: 'dev-webhook',
            },
          },
        }),
      );
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: { message: 'fail' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService();
      await expect(
        service.deleteResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
