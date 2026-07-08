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
        targetEnvironmentRefs: [{ name: 'staging' }],
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
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sReleaseBinding] }),
      );
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
      expect(result[0].dataPlaneKind).toBe('DataPlane');
      expect(result[0].deployment.status).toBe('Ready');
      expect(result[0].deployment.releaseName).toBe('release-1');
      // Raw binding conditions flow through to the deployment so the detail
      // panel can surface the controller's failure reason + message.
      expect(result[0].deployment.conditions).toEqual(
        k8sReleaseBinding.status.conditions,
      );
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
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
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
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sReleaseBinding] }),
      );
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
      ).rejects.toThrow();
    });
  });

  describe('deleteReleaseBinding', () => {
    it('deletes binding and refetches deployment info', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });
      // fetchDeploymentInfo calls (env, bindings, project, pipeline)
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sEnvironment], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

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
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sReleaseBinding] }),
      );
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
      ).rejects.toThrow();
    });
  });

  describe('fetchReleaseBindings', () => {
    it('returns release bindings from new API', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sReleaseBinding] }),
      );

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

  describe('fetchResourceReleaseBindings', () => {
    function rrb(projectName: string, environment: string) {
      return {
        metadata: { name: `binding-${environment}`, namespace: 'test-ns' },
        spec: {
          owner: { projectName, resourceName: 'analytics-db' },
          environment,
          resourceRelease: `analytics-db-${environment}-abc`,
        },
        status: {
          conditions: [
            {
              type: 'Ready',
              status: 'True',
              reason: 'Ready',
              message: 'Resource ready',
            },
          ],
        },
      };
    }

    it('returns bindings filtered to the requested project', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            rrb('my-project', 'dev'),
            rrb('other-project', 'dev'),
            rrb('my-project', 'staging'),
          ],
        }),
      );

      const service = createService();
      const result = await service.fetchResourceReleaseBindings(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect((result as any).items).toHaveLength(2);
      expect(
        (result as any).items.map((b: any) => b.spec.environment).sort(),
      ).toEqual(['dev', 'staging']);
      expect(
        (result as any).items.every(
          (b: any) => b.spec.owner.projectName === 'my-project',
        ),
      ).toBe(true);
    });

    it('returns an empty list when no bindings match the project', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [rrb('other-project', 'dev')] }),
      );

      const service = createService();
      const result = await service.fetchResourceReleaseBindings(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect((result as any).items).toEqual([]);
    });

    it('passes the resource query to the openchoreo-api', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));

      const service = createService();
      await service.fetchResourceReleaseBindings(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      const call = mockGET.mock.calls[0];
      expect(call[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/resourcereleasebindings',
      );
      expect(call[1]).toMatchObject({
        params: {
          path: { namespaceName: 'test-ns' },
          query: { resource: 'analytics-db' },
        },
      });
    });
  });

  describe('fetchResourceEnvironmentInfo', () => {
    function rrbWithOutputs(
      projectName: string,
      environment: string,
      release: string,
    ) {
      return {
        metadata: {
          name: `binding-${environment}`,
          namespace: 'test-ns',
          creationTimestamp: '2025-01-06T11:00:00Z',
        },
        spec: {
          owner: { projectName, resourceName: 'analytics-db' },
          environment,
          resourceRelease: release,
          retainPolicy: 'Delete',
        },
        status: {
          conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
          outputs: [
            { name: 'host', value: 'db.dev.svc' },
            {
              name: 'password',
              secretKeyRef: { name: 'db-creds', key: 'password' },
            },
          ],
        },
      };
    }

    const k8sResource = {
      metadata: { name: 'analytics-db', namespace: 'test-ns' },
      spec: { type: { kind: 'ResourceType', name: 'postgres' } },
      status: {
        latestRelease: { name: 'analytics-db-zzz', hash: 'zzz' },
      },
    };

    it('returns one entry per pipeline environment with binding + latestRelease joined', async () => {
      // env list
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      // resource release bindings (dev only)
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [rrbWithOutputs('my-project', 'dev', 'analytics-db-abc')],
        }),
      );
      // project
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // resource
      mockGET.mockResolvedValueOnce(createOkResponse(k8sResource));
      // pipeline
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchResourceEnvironmentInfo(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result.map(e => e.name)).toEqual(['dev', 'staging']);

      expect(result[0].bindingName).toBe('binding-dev');
      expect(result[0].resourceRelease).toBe('analytics-db-abc');
      expect(result[0].retainPolicy).toBe('Delete');
      expect(result[0].status).toBe('Ready');
      expect(result[0].latestRelease).toBe('analytics-db-zzz');
      expect(result[0].outputs).toEqual([
        { name: 'host', value: 'db.dev.svc' },
        {
          name: 'password',
          secretKeyRef: { name: 'db-creds', key: 'password' },
        },
      ]);
      expect(result[0].promotionTargets).toEqual([
        { name: 'staging', resourceName: 'staging' },
      ]);

      expect(result[1].bindingName).toBeUndefined();
      expect(result[1].resourceRelease).toBeUndefined();
      expect(result[1].latestRelease).toBe('analytics-db-zzz');
    });

    it('filters bindings to the owning project', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            rrbWithOutputs('my-project', 'dev', 'rel-mine'),
            rrbWithOutputs('other-project', 'dev', 'rel-theirs'),
          ],
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sResource));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchResourceEnvironmentInfo(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].resourceRelease).toBe('rel-mine');
    });

    it('returns environments with no bindings when none exist', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sResource));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchResourceEnvironmentInfo(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result.every(e => e.bindingName === undefined)).toBe(true);
      expect(result.every(e => e.latestRelease === 'analytics-db-zzz')).toBe(
        true,
      );
    });

    it('throws rather than defaulting to all environments when the pipeline cannot be resolved', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project without deploymentPipelineRef → pipeline unresolved
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sResource));

      const service = createService();
      await expect(
        service.fetchResourceEnvironmentInfo(
          {
            resourceName: 'analytics-db',
            projectName: 'my-project',
            namespaceName: 'test-ns',
          },
          'token-123',
        ),
      ).rejects.toThrow(/could not be loaded/);
    });

    it('returns env-info without latestRelease when resource fetch errors', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [rrbWithOutputs('my-project', 'dev', 'rel-1')],
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // resource fetch errors
      mockGET.mockResolvedValueOnce(createErrorResponse());
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchResourceEnvironmentInfo(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].resourceRelease).toBe('rel-1');
      expect(result[0].latestRelease).toBeUndefined();
    });
  });

  describe('updateResourceReleaseBinding', () => {
    const existingBinding = {
      metadata: {
        name: 'analytics-db-dev',
        namespace: 'test-ns',
        creationTimestamp: '2025-01-06T11:00:00Z',
        resourceVersion: '42',
      },
      spec: {
        owner: { projectName: 'my-project', resourceName: 'analytics-db' },
        environment: 'dev',
        resourceRelease: 'analytics-db-old',
        retainPolicy: 'Delete',
      },
      status: { conditions: [] },
    };

    it('GETs the existing binding then PUTs with the new resourceRelease', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(existingBinding));
      mockPUT.mockResolvedValueOnce(createOkResponse({ ...existingBinding }));

      const service = createService();
      await service.updateResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'analytics-db-new',
        },
        'token-123',
      );

      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledTimes(1);
      const putCall = mockPUT.mock.calls[0];
      expect(putCall[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}',
      );
      expect(putCall[1].body.spec.resourceRelease).toBe('analytics-db-new');
      expect(putCall[1].body.spec.retainPolicy).toBe('Delete');
      expect(putCall[1].body.spec).not.toHaveProperty('state');
    });

    it('overrides retainPolicy when provided', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(existingBinding));
      mockPUT.mockResolvedValueOnce(createOkResponse({ ...existingBinding }));

      const service = createService();
      await service.updateResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'analytics-db-new',
          retainPolicy: 'Retain',
        },
        'token-123',
      );

      expect(mockPUT.mock.calls[0][1].body.spec.retainPolicy).toBe('Retain');
    });

    it('passes resourceTypeEnvironmentConfigs into the spec when provided', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(existingBinding));
      mockPUT.mockResolvedValueOnce(createOkResponse({ ...existingBinding }));

      const service = createService();
      await service.updateResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'analytics-db-new',
          resourceTypeEnvironmentConfigs: { replicas: 3 },
        },
        'token-123',
      );

      expect(
        mockPUT.mock.calls[0][1].body.spec.resourceTypeEnvironmentConfigs,
      ).toEqual({ replicas: 3 });
    });

    it('POSTs a new binding when GET returns 404', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(404));
      mockPOST.mockResolvedValueOnce(
        createOkResponse({ metadata: { name: 'analytics-db-dev' } }),
      );

      const service = createService();
      await service.updateResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'analytics-db-new',
          retainPolicy: 'Retain',
        },
        'token-123',
      );

      expect(mockPUT).not.toHaveBeenCalled();
      expect(mockPOST).toHaveBeenCalledTimes(1);
      const postCall = mockPOST.mock.calls[0];
      expect(postCall[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/resourcereleasebindings',
      );
      const body = postCall[1].body;
      expect(body.metadata.name).toBe('analytics-db-dev');
      expect(body.spec.owner).toEqual({
        projectName: 'my-project',
        resourceName: 'analytics-db',
      });
      expect(body.spec.environment).toBe('dev');
      expect(body.spec.resourceRelease).toBe('analytics-db-new');
      expect(body.spec.retainPolicy).toBe('Retain');
      expect(body.spec).not.toHaveProperty('state');
    });

    it('refetches the binding when POST returns 409', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(404));
      mockPOST.mockResolvedValueOnce(createErrorResponse(409));
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          metadata: { name: 'analytics-db-dev' },
          spec: { resourceRelease: 'rel-from-conflict' },
        }),
      );

      const service = createService();
      const result = await service.updateResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'analytics-db-new',
        },
        'token-123',
      );

      expect((result as any)?.metadata?.name).toBe('analytics-db-dev');
      expect((result as any)?.spec?.resourceRelease).toBe('rel-from-conflict');
    });

    it('throws when GET returns a non-404 error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(500));

      const service = createService();
      await expect(
        service.updateResourceReleaseBinding(
          {
            resourceName: 'analytics-db',
            projectName: 'my-project',
            namespaceName: 'test-ns',
            environment: 'dev',
            releaseName: 'analytics-db-new',
          },
          'token-123',
        ),
      ).rejects.toThrow(/Failed to fetch resource release binding/);

      expect(mockPUT).not.toHaveBeenCalled();
      expect(mockPOST).not.toHaveBeenCalled();
    });
  });

  describe('deleteResourceReleaseBinding', () => {
    it('pre-flight GETs the binding, then DELETEs by composed name', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ metadata: { name: 'analytics-db-dev' } }),
      );
      mockDELETE.mockResolvedValueOnce(createOkResponse(undefined));

      const service = createService();
      const result = await service.deleteResourceReleaseBinding(
        {
          resourceName: 'analytics-db',
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
        },
        'token-123',
      );

      expect(result).toEqual({ success: true });
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockGET.mock.calls[0][1]).toMatchObject({
        params: {
          path: {
            namespaceName: 'test-ns',
            resourceReleaseBindingName: 'analytics-db-dev',
          },
        },
      });
      expect(mockDELETE).toHaveBeenCalledTimes(1);
      const call = mockDELETE.mock.calls[0];
      expect(call[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}',
      );
      expect(call[1]).toMatchObject({
        params: {
          path: {
            namespaceName: 'test-ns',
            resourceReleaseBindingName: 'analytics-db-dev',
          },
        },
      });
    });

    it('throws (and skips DELETE) when pre-flight GET returns 404', async () => {
      // Defense-in-depth against the openchoreo-api silently returning 204
      // for delete on names that resolve to no binding on the cluster.
      mockGET.mockResolvedValueOnce(createErrorResponse(404));

      const service = createService();
      await expect(
        service.deleteResourceReleaseBinding(
          {
            resourceName: 'analytics-db',
            projectName: 'my-project',
            namespaceName: 'test-ns',
            environment: 'Production',
          },
          'token-123',
        ),
      ).rejects.toThrow();

      expect(mockDELETE).not.toHaveBeenCalled();
    });

    it('propagates an error response from the openchoreo-api', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ metadata: { name: 'analytics-db-dev' } }),
      );
      mockDELETE.mockResolvedValueOnce(createErrorResponse(403));

      const service = createService();
      await expect(
        service.deleteResourceReleaseBinding(
          {
            resourceName: 'analytics-db',
            projectName: 'my-project',
            namespaceName: 'test-ns',
            environment: 'dev',
          },
          'token-123',
        ),
      ).rejects.toThrow();
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
            targetEnvironmentRefs: [{ name: 'staging' }],
          },
          {
            sourceEnvironmentRef: 'staging',
            targetEnvironmentRefs: [{ name: 'prod' }],
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

    it('throws rather than defaulting to all environments when the pipeline cannot be resolved', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project with no pipeline ref → pipeline unresolved
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));

      const service = createService();
      await expect(
        service.fetchDeploymentInfo(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
          },
          'token-123',
        ),
      ).rejects.toThrow(/could not be loaded/);
    });

    it('returns no environments when the pipeline has empty promotionPaths', async () => {
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

      // A resolved pipeline that defines no promotion paths has no deployable
      // environments — the UI shows its empty state
      expect(result).toHaveLength(0);
    });

    it('surfaces a Forbidden error (not "pipeline unavailable") when the pipeline read is denied', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: allEnvs, pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProject));
      // deploymentpipelines:view denied → 403 on the pipeline read
      mockGET.mockResolvedValueOnce(createErrorResponse(403));

      const service = createService();
      await expect(
        service.fetchDeploymentInfo(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
          },
          'token-123',
        ),
      ).rejects.toMatchObject({ name: 'NotAllowedError' });
    });
  });

  describe('fetchProjectEnvironmentInfo', () => {
    function prbBinding(
      projectName: string,
      environment: string,
      release: string,
    ) {
      return {
        metadata: {
          name: `${projectName}-${environment}`,
          namespace: 'test-ns',
          creationTimestamp: '2025-01-06T11:00:00Z',
        },
        spec: {
          owner: { projectName },
          environment,
          projectRelease: release,
          environmentConfigs: { replicas: 2 },
        },
        status: {
          conditions: [
            {
              type: 'Ready',
              status: 'True',
              reason: 'Ready',
              lastTransitionTime: '2025-01-06T11:05:00Z',
            },
          ],
          namespace: `dp-test-ns-${projectName}-${environment}-abc`,
        },
      };
    }

    const k8sProjectWithRelease = {
      metadata: { name: 'my-project', namespace: 'test-ns' },
      spec: { deploymentPipelineRef: { name: 'default-pipeline' } },
      status: {
        latestRelease: { name: 'my-project-zzz', hash: 'zzz' },
      },
    };

    it('returns one entry per pipeline environment with binding + latestRelease joined', async () => {
      // env list
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      // project release bindings (dev only)
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [prbBinding('my-project', 'dev', 'my-project-abc')],
        }),
      );
      // project (pipeline ref)
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      // project (latestRelease)
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      // pipeline
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result.map(e => e.name)).toEqual(['dev', 'staging']);

      expect(result[0].bindingName).toBe('my-project-dev');
      expect(result[0].projectRelease).toBe('my-project-abc');
      expect(result[0].status).toBe('Ready');
      expect(result[0].namespace).toBe('dp-test-ns-my-project-dev-abc');
      expect(result[0].latestRelease).toBe('my-project-zzz');
      expect(result[0].promotionTargets).toEqual([
        { name: 'staging', resourceName: 'staging' },
      ]);

      expect(result[1].bindingName).toBeUndefined();
      expect(result[1].projectRelease).toBeUndefined();
      expect(result[1].latestRelease).toBe('my-project-zzz');
    });

    it('filters bindings to the owning project', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            prbBinding('my-project', 'dev', 'rel-mine'),
            prbBinding('other-project', 'dev', 'rel-theirs'),
          ],
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].projectRelease).toBe('rel-mine');
    });

    it('returns environments with no bindings when none exist', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result.every(e => e.bindingName === undefined)).toBe(true);
      expect(result.every(e => e.latestRelease === 'my-project-zzz')).toBe(
        true,
      );
    });

    it('throws rather than defaulting to all environments when the pipeline cannot be resolved', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      // project without deploymentPipelineRef (pipeline fetch) → unresolved
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));
      // project (latestRelease fetch)
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectNoPipeline));

      const service = createService();
      await expect(
        service.fetchProjectEnvironmentInfo(
          {
            projectName: 'my-project',
            namespaceName: 'test-ns',
          },
          'token-123',
        ),
      ).rejects.toThrow(/could not be loaded/);
    });

    it('returns env-info without latestRelease when project fetch errors', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev')],
          pagination: {},
        }),
      );
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [prbBinding('my-project', 'dev', 'rel-1')],
        }),
      );
      // pipeline's project fetch ok (has pipelineRef)
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      // latestRelease project fetch errors
      mockGET.mockResolvedValueOnce(createErrorResponse());
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].projectRelease).toBe('rel-1');
      expect(result[0].latestRelease).toBeUndefined();
    });

    it('returns an empty array when there are no environments', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [], pagination: {} }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      );

      expect(result).toEqual([]);
    });

    it('tolerates a bindings fetch failure and returns unbound envs', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [makeK8sEnvironment('dev'), makeK8sEnvironment('staging')],
          pagination: {},
        }),
      );
      // bindings fetch fails — the env-info join should soft-fail to no bindings
      mockGET.mockResolvedValueOnce(createErrorResponse());
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result.every(e => e.bindingName === undefined)).toBe(true);
    });

    it('appends bound environments that are not in the pipeline (drift)', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            makeK8sEnvironment('dev'),
            makeK8sEnvironment('staging'),
            makeK8sEnvironment('legacy'),
          ],
          pagination: {},
        }),
      );
      // 'legacy' has a binding but the pipeline only covers dev -> staging.
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [prbBinding('my-project', 'legacy', 'rel-legacy')],
        }),
      );
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sProjectWithRelease));
      mockGET.mockResolvedValueOnce(createOkResponse(k8sPipeline));

      const service = createService();
      const result = await service.fetchProjectEnvironmentInfo(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      );

      const legacy = result.find(e => e.name === 'legacy');
      expect(legacy).toBeDefined();
      expect(legacy?.projectRelease).toBe('rel-legacy');
    });
  });

  describe('fetchProjectReleaseBindings', () => {
    function prb(projectName: string, environment: string, release: string) {
      return {
        metadata: {
          name: `${projectName}-${environment}`,
          namespace: 'test-ns',
        },
        spec: { owner: { projectName }, environment, projectRelease: release },
        status: {},
      };
    }

    it('returns bindings filtered to the requested project', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [
            prb('my-project', 'dev', 'rel-1'),
            prb('other-project', 'dev', 'rel-2'),
          ],
        }),
      );

      const service = createService();
      const result = (await service.fetchProjectReleaseBindings(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      )) as { items: any[] };

      expect(result.items).toHaveLength(1);
      expect(result.items[0].spec.owner.projectName).toBe('my-project');
    });

    it('passes the project query to the openchoreo-api', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));

      const service = createService();
      await service.fetchProjectReleaseBindings(
        { projectName: 'my-project', namespaceName: 'test-ns' },
        'token-123',
      );

      const call = mockGET.mock.calls[0];
      expect(call[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/projectreleasebindings',
      );
      expect(call[1].params.query).toEqual({ project: 'my-project' });
    });

    it('throws when the bindings API errors', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(500));

      const service = createService();
      await expect(
        service.fetchProjectReleaseBindings(
          { projectName: 'my-project', namespaceName: 'test-ns' },
          'token-123',
        ),
      ).rejects.toThrow();
    });
  });

  describe('updateProjectReleaseBinding', () => {
    const existingBinding = {
      metadata: {
        name: 'my-project-dev',
        namespace: 'test-ns',
        creationTimestamp: '2025-01-06T11:00:00Z',
        resourceVersion: '42',
      },
      spec: {
        owner: { projectName: 'my-project' },
        environment: 'dev',
        projectRelease: 'my-project-old',
      },
      status: { conditions: [] },
    };

    it('GETs the existing binding then PUTs with the new projectRelease, preserving owner + environment', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(existingBinding));
      mockPUT.mockResolvedValueOnce(createOkResponse({ ...existingBinding }));

      const service = createService();
      await service.updateProjectReleaseBinding(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'my-project-new',
        },
        'token-123',
      );

      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledTimes(1);
      const putCall = mockPUT.mock.calls[0];
      expect(putCall[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/projectreleasebindings/{projectReleaseBindingName}',
      );
      expect(putCall[1].body.spec.projectRelease).toBe('my-project-new');
      // owner + environment are immutable and must be carried over untouched
      expect(putCall[1].body.spec.owner).toEqual({ projectName: 'my-project' });
      expect(putCall[1].body.spec.environment).toBe('dev');
    });

    it('passes environmentConfigs into the spec when provided', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(existingBinding));
      mockPUT.mockResolvedValueOnce(createOkResponse({ ...existingBinding }));

      const service = createService();
      await service.updateProjectReleaseBinding(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'my-project-new',
          environmentConfigs: { replicas: 3 },
        },
        'token-123',
      );

      expect(mockPUT.mock.calls[0][1].body.spec.environmentConfigs).toEqual({
        replicas: 3,
      });
    });

    it('POSTs a new binding when GET returns 404 (owner carries only projectName)', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(404));
      mockPOST.mockResolvedValueOnce(
        createOkResponse({ metadata: { name: 'my-project-dev' } }),
      );

      const service = createService();
      await service.updateProjectReleaseBinding(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'my-project-new',
          environmentConfigs: { replicas: 1 },
        },
        'token-123',
      );

      expect(mockPUT).not.toHaveBeenCalled();
      expect(mockPOST).toHaveBeenCalledTimes(1);
      const postCall = mockPOST.mock.calls[0];
      expect(postCall[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/projectreleasebindings',
      );
      const body = postCall[1].body;
      expect(body.metadata.name).toBe('my-project-dev');
      expect(body.spec.owner).toEqual({ projectName: 'my-project' });
      expect(body.spec.owner).not.toHaveProperty('resourceName');
      expect(body.spec.environment).toBe('dev');
      expect(body.spec.projectRelease).toBe('my-project-new');
      expect(body.spec.environmentConfigs).toEqual({ replicas: 1 });
    });

    it('refetches the binding when POST returns 409', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(404));
      mockPOST.mockResolvedValueOnce(createErrorResponse(409));
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          metadata: { name: 'my-project-dev' },
          spec: { projectRelease: 'rel-from-conflict' },
        }),
      );

      const service = createService();
      const result = await service.updateProjectReleaseBinding(
        {
          projectName: 'my-project',
          namespaceName: 'test-ns',
          environment: 'dev',
          releaseName: 'my-project-new',
        },
        'token-123',
      );

      expect((result as any)?.metadata?.name).toBe('my-project-dev');
      expect((result as any)?.spec?.projectRelease).toBe('rel-from-conflict');
    });

    it('throws when GET returns a non-404 error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(500));

      const service = createService();
      await expect(
        service.updateProjectReleaseBinding(
          {
            projectName: 'my-project',
            namespaceName: 'test-ns',
            environment: 'dev',
            releaseName: 'my-project-new',
          },
          'token-123',
        ),
      ).rejects.toThrow(/Failed to fetch project release binding/);

      expect(mockPUT).not.toHaveBeenCalled();
      expect(mockPOST).not.toHaveBeenCalled();
    });
  });
});
