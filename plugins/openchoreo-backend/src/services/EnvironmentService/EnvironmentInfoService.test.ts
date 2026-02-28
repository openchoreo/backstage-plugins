import { mockServices } from '@backstage/backend-test-utils';
import { EnvironmentInfoService } from './EnvironmentInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockPUT = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PUT: mockPUT,
    DELETE: mockDELETE,
  })),
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PATCH: jest.fn(),
    DELETE: mockDELETE,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const k8sEnvironment = {
  metadata: {
    name: 'dev',
    namespace: 'test-ns',
    uid: 'env-uid-001',
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {
      'openchoreo.dev/display-name': 'dev',
      'openchoreo.dev/description': 'Dev environment',
    },
  },
  spec: {
    dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
    isProduction: false,
    gateway: { publicVirtualHost: 'dev.example.com' },
  },
  status: { conditions: [readyCondition] },
};

const k8sReleaseBinding = {
  metadata: {
    name: 'api-service-dev',
    namespace: 'test-ns',
    generation: 1,
    creationTimestamp: '2025-01-06T11:00:00Z',
    annotations: {},
    labels: {},
  },
  spec: {
    owner: { projectName: 'my-project', componentName: 'api-service' },
    environment: 'dev',
    releaseName: 'release-1',
    componentTypeEnvOverrides: {},
  },
  status: {
    conditions: [
      {
        type: 'ReleaseSynced',
        status: 'True',
        observedGeneration: 1,
        lastTransitionTime: '2025-01-06T10:00:03Z',
        reason: 'Reconciled',
        message: 'Release synced',
      },
      {
        type: 'ResourcesReady',
        status: 'True',
        observedGeneration: 1,
        lastTransitionTime: '2025-01-06T10:00:04Z',
        reason: 'Reconciled',
        message: 'Resources ready',
      },
      {
        type: 'Ready',
        status: 'True',
        observedGeneration: 1,
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
    ],
  },
};

const k8sPipeline = {
  metadata: {
    name: 'default-pipeline',
    namespace: 'test-ns',
    uid: 'pipeline-uid-001',
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {
      'openchoreo.dev/display-name': 'Default Pipeline',
      'openchoreo.dev/description': 'Default pipeline',
    },
  },
  spec: {
    promotionPaths: [
      {
        sourceEnvironmentRef: 'dev',
        targetEnvironmentRefs: [{ name: 'staging', requiresApproval: true }],
      },
    ],
  },
  status: { conditions: [readyCondition] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return EnvironmentInfoService.create(mockLogger, 'http://test:8080');
}

function okResponse(data: any) {
  return { data, error: undefined, response: { ok: true, status: 200 } };
}

function errorResponse(status = 500) {
  return {
    data: undefined,
    error: { message: 'fail' },
    response: { ok: false, status, statusText: 'Internal Server Error' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EnvironmentInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDeploymentInfo', () => {
    it('fetches environments, bindings, and pipeline then returns combined data', async () => {
      // 1. environments (via fetchAllPages)
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      // 2. release bindings
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sReleaseBinding] }));
      // 3. deployment pipelines
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sPipeline] }));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('dev');
      expect(result[0].resourceName).toBe('dev');
      expect(result[0].dataPlaneRef).toBe('default-dp');
      expect(result[0].deployment.status).toBe('Ready');
      expect(result[0].deployment.releaseName).toBe('release-1');
    });

    it('returns environments even when bindings fetch fails', async () => {
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      // bindings fail
      mockGET.mockResolvedValueOnce(errorResponse());
      // pipeline
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sPipeline] }));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      // Should still return environments, just without binding data
      expect(result).toHaveLength(1);
      expect(result[0].deployment.status).toBeUndefined();
    });

    it('returns empty array when no environments found', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [], pagination: {} }));
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toEqual([]);
    });
  });

  describe('promoteComponent', () => {
    it('calls promote endpoint then refetches deployment info', async () => {
      // POST promote
      mockPOST.mockResolvedValueOnce(okResponse({}));
      // Then fetchDeploymentInfo internally calls 3 GETs:
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sReleaseBinding] }));
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sPipeline] }));

      const service = createService();
      const result = await service.promoteComponent(
        {
          sourceEnvironment: 'dev',
          targetEnvironment: 'staging',
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(mockPOST).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('throws when promote API fails', async () => {
      mockPOST.mockResolvedValueOnce(errorResponse());

      const service = createService();
      await expect(
        service.promoteComponent(
          {
            sourceEnvironment: 'dev',
            targetEnvironment: 'staging',
            componentName: 'api-service',
            projectName: 'my-project',
            namespaceName: 'test-ns',
          },
          'token',
        ),
      ).rejects.toThrow('Failed to promote component');
    });
  });

  describe('deleteReleaseBinding', () => {
    it('deletes binding and refetches deployment info', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });
      // fetchDeploymentInfo calls
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService();
      const result = await service.deleteReleaseBinding(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
        },
        'token-123',
      );

      expect(mockDELETE).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('deployRelease', () => {
    it('deploys release and refetches deployment info', async () => {
      mockPOST.mockResolvedValueOnce(okResponse({}));
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sReleaseBinding] }));
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sPipeline] }));

      const service = createService();
      const result = await service.deployRelease(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          releaseName: 'release-1',
        },
        'token-123',
      );

      expect(mockPOST).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('throws when deploy fails', async () => {
      mockPOST.mockResolvedValueOnce(errorResponse());

      const service = createService();
      await expect(
        service.deployRelease(
          {
            componentName: 'api-service',
            projectName: 'my-project',
            namespaceName: 'test-ns',
            releaseName: 'release-1',
          },
          'token',
        ),
      ).rejects.toThrow('Failed to deploy release');
    });
  });

  describe('fetchReleaseBindings', () => {
    it('returns release bindings from new API', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sReleaseBinding] }));

      const service = createService();
      const result = await service.fetchReleaseBindings(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect((result as any).items).toHaveLength(1);
    });
  });

  describe('fetchComponentReleaseSchema', () => {
    it('returns schema from new API', async () => {
      const schema = { type: 'object', properties: {} };
      mockGET.mockResolvedValueOnce(okResponse(schema));

      const service = createService();
      const result = await service.fetchComponentReleaseSchema(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          releaseName: 'release-1',
        },
        'token-123',
      );

      expect(result).toEqual(schema);
    });
  });

  describe('fetchEnvironmentRelease', () => {
    it('returns first matching release', async () => {
      const release = {
        metadata: { name: 'release-1' },
        spec: { version: '1.0.0' },
        status: { phase: 'Active' },
      };
      mockGET.mockResolvedValueOnce(okResponse({ items: [release] }));

      const service = createService();
      const result = await service.fetchEnvironmentRelease(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token-123',
      );

      expect(result).toEqual({
        data: { spec: release.spec, status: release.status },
      });
    });

    it('returns null when no matching release', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService();
      const result = await service.fetchEnvironmentRelease(
        {
          componentName: 'api-service',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environmentName: 'dev',
        },
        'token-123',
      );

      expect(result).toBeNull();
    });
  });
});
