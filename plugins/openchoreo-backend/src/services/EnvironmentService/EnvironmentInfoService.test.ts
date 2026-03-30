import { mockServices } from '@backstage/backend-test-utils';
import { EnvironmentInfoService } from './EnvironmentInfoService';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';

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

function makeK8sEnvironment(
  name: string,
  overrides?: { isProduction?: boolean; displayName?: string },
) {
  const display = overrides?.displayName ?? name;
  return {
    metadata: {
      name,
      namespace: 'test-ns',
      uid: `env-uid-${name}`,
      creationTimestamp: '2025-01-06T10:00:00Z',
      labels: {},
      annotations: {
        'openchoreo.dev/display-name': display,
        'openchoreo.dev/description': `${name} environment`,
      },
    },
    spec: {
      dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
      isProduction: overrides?.isProduction ?? false,
      gateway: { publicVirtualHost: `${name}.example.com` },
    },
    status: { conditions: [readyCondition] },
  };
}

const k8sEnvironment = makeK8sEnvironment('dev');

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
    componentTypeEnvironmentConfigs: {},
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

const k8sProject = {
  metadata: { name: 'my-project', namespace: 'test-ns' },
  spec: { deploymentPipelineRef: { name: 'default-pipeline' } },
};

const k8sProjectNoPipeline = {
  metadata: { name: 'my-project', namespace: 'test-ns' },
  spec: {},
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
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      // 2. release bindings
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [k8sReleaseBinding] }));
      // 3. project (to get deploymentPipelineRef)
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // 4. deployment pipeline by name
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

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
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      // bindings fail
      mockGET.mockResolvedValueOnce(createErrorResponse());
      // project
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // pipeline by name
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

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
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [], pagination: {} }));
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project with no pipeline ref
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));

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
      mockPOST.mockResolvedValueOnce(createOkResponse({}));
      // Then fetchDeploymentInfo internally calls 4 GETs:
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [k8sReleaseBinding] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

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
      mockPOST.mockResolvedValueOnce(createErrorResponse());

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
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project with no pipeline ref
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));

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
      mockPOST.mockResolvedValueOnce(createOkResponse({}));
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [k8sReleaseBinding] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

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
      mockPOST.mockResolvedValueOnce(createErrorResponse());

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
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [k8sReleaseBinding] }));

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
      mockGET.mockResolvedValueOnce(createOkResponse(schema));

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

  describe('pipeline environment filtering', () => {
    const allEnvs = [
      makeK8sEnvironment('dev'),
      makeK8sEnvironment('staging'),
      makeK8sEnvironment('pre-prod'),
      makeK8sEnvironment('prod', {
        isProduction: true,
        displayName: 'Production Environment',
      }),
      makeK8sEnvironment('qa'),
    ];

    const pipelineDevStagingProd = {
      metadata: {
        name: 'default-pipeline',
        namespace: 'test-ns',
        uid: 'pipeline-uid-002',
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
            targetEnvironmentRefs: [
              { name: 'staging', requiresApproval: false },
            ],
          },
          {
            sourceEnvironmentRef: 'staging',
            targetEnvironmentRefs: [{ name: 'prod', requiresApproval: true }],
          },
        ],
      },
      status: { conditions: [readyCondition] },
    };

    it('only returns pipeline environments when pipeline exists', async () => {
      // environments (5 in namespace)
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      // bindings (none)
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // pipeline by name
      mockGET.mockResolvedValueOnce(createOkResponse(pipelineDevStagingProd));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      const envNames = result.map(e => e.name);
      expect(envNames).toEqual(['dev', 'staging', 'Production Environment']);
      expect(envNames).not.toContain('pre-prod');
      expect(envNames).not.toContain('qa');
    });

    it('returns environments in pipeline order', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(pipelineDevStagingProd));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result[0].name).toBe('dev');
      expect(result[1].name).toBe('staging');
      expect(result[2].name).toBe('Production Environment');
    });

    it('returns all environments when no pipeline exists', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project with no pipeline ref
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(5);
    });

    it('returns all environments when pipeline has empty promotionPaths', async () => {
      const emptyPipeline = {
        ...pipelineDevStagingProd,
        spec: { promotionPaths: [] },
      };
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(emptyPipeline));

      const service = createService();
      const result = await service.fetchDeploymentInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      // Empty promotionPaths treated as no pipeline → show all environments
      expect(result).toHaveLength(5);
    });
  });
});
