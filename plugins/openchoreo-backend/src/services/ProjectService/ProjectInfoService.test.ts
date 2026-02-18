import { mockServices } from '@backstage/backend-test-utils';
import { ProjectInfoService } from './ProjectInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    DELETE: mockDELETE,
  })),
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
    DELETE: mockDELETE,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'my-project',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'My Project',
    'openchoreo.dev/description': 'A test project',
  },
};

const k8sProject = {
  metadata: baseMeta,
  spec: { deploymentPipelineRef: 'default-pipeline' },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
    ],
  },
};

const k8sPipeline = {
  metadata: { ...baseMeta, name: 'default-pipeline' },
  spec: {
    promotionPaths: [
      {
        sourceEnvironmentRef: 'dev',
        targetEnvironmentRefs: [{ name: 'staging', requiresApproval: true }],
      },
    ],
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new ProjectInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('ProjectInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProjectDetails', () => {
    it('calls new API endpoint and transforms response', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sProject));

      const service = createService(true);
      const result = await service.fetchProjectDetails(
        'test-ns',
        'my-project',
        'token-123',
      );

      // Verify transformer was applied — legacy flat shape
      expect(result.name).toBe('my-project');
      expect(result.namespaceName).toBe('test-ns');
      expect(result.uid).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.displayName).toBe('My Project');
      expect(result.description).toBe('A test project');
      expect(result.deploymentPipeline).toBe('default-pipeline');
      expect(result.status).toBe('Ready');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchProjectDetails('test-ns', 'my-project', 'token-123'),
      ).rejects.toThrow('Failed to fetch project');
    });
  });

  describe('fetchProjectDeploymentPipeline', () => {
    it('fetches project then pipeline and transforms', async () => {
      // First call: fetch project to get deploymentPipelineRef
      mockGET.mockResolvedValueOnce(okResponse(k8sProject));
      // Second call: fetch the pipeline by name
      mockGET.mockResolvedValueOnce(okResponse(k8sPipeline));

      const service = createService(true);
      const result = await service.fetchProjectDeploymentPipeline(
        'test-ns',
        'my-project',
        'token-123',
      );

      expect(result.name).toBe('default-pipeline');
      expect(result.namespaceName).toBe('test-ns');
      expect(result.promotionPaths).toHaveLength(1);
      expect(result.promotionPaths![0].sourceEnvironmentRef).toBe('dev');
      expect(mockGET).toHaveBeenCalledTimes(2);
    });

    it('throws when project has no pipeline ref', async () => {
      const noPipeline = {
        ...k8sProject,
        spec: { deploymentPipelineRef: undefined },
      };
      mockGET.mockResolvedValueOnce(okResponse(noPipeline));

      const service = createService(true);
      await expect(
        service.fetchProjectDeploymentPipeline(
          'test-ns',
          'my-project',
          'token-123',
        ),
      ).rejects.toThrow('no deployment pipeline reference');
    });

    it('throws when pipeline fetch fails', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sProject));
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchProjectDeploymentPipeline(
          'test-ns',
          'my-project',
          'token-123',
        ),
      ).rejects.toThrow('Failed to fetch deployment pipeline');
    });
  });

  describe('deleteProject', () => {
    it('calls new API DELETE endpoint', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService(true);
      await service.deleteProject('test-ns', 'my-project', 'token-123');

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: { message: 'fail' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService(true);
      await expect(
        service.deleteProject('test-ns', 'my-project', 'token-123'),
      ).rejects.toThrow('Failed to delete project');
    });
  });
});
