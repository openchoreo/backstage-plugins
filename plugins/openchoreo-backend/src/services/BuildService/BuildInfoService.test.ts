import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { BuildInfoService } from './BuildInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPOST = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
  })),
  createObservabilityClientWithUrl: jest.fn(),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'run-001',
  namespace: 'test-ns',
  uid: 'run-uid-001',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {
    'openchoreo.dev/component': 'api-service',
    'openchoreo.dev/project': 'my-project',
  },
  annotations: {
    'openchoreo.dev/display-name': 'Run 001',
    'openchoreo.dev/description': 'Test run',
    'openchoreo.dev/commit': 'abc1234',
    'openchoreo.dev/image': 'registry.example.com/api-service:abc1234',
  },
};

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const k8sWorkflowRun = {
  metadata: baseMeta,
  spec: {
    owner: { projectName: 'my-project', componentName: 'api-service' },
    workflow: {
      name: 'docker-build',
      parameters: {
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'main', commit: 'abc1234' },
          appPath: '.',
        },
      },
    },
  },
  status: {
    conditions: [readyCondition],
    imageStatus: { image: 'registry.example.com/api-service:abc1234' },
    tasks: [
      {
        name: 'build',
        phase: 'Succeeded',
        startedAt: '2025-01-06T10:00:00Z',
        completedAt: '2025-01-06T10:05:00Z',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new BuildInfoService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BuildInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchBuilds', () => {
    it('fetches builds via new API and transforms results', async () => {
      // fetchAllPages mock calls fetchPage once, returns items
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sWorkflowRun], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchBuilds(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toHaveLength(1);
      // Verify transformer applied
      expect(result[0].componentName).toBe('api-service');
      expect(result[0].projectName).toBe('my-project');
      expect(result[0].uuid).toBe('run-uid-001');
      expect(result[0].image).toBe('registry.example.com/api-service:abc1234');
      expect(result[0].commit).toBe('abc1234');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchBuilds('test-ns', 'my-project', 'api-service', 'token'),
      ).rejects.toThrow();
    });
  });

  describe('getWorkflowRun', () => {
    it('fetches single run via new API and transforms', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sWorkflowRun));

      const service = createService();
      const result = await service.getWorkflowRun(
        'test-ns',
        'my-project',
        'api-service',
        'run-001',
        'token-123',
      );

      expect(result.uuid).toBe('run-uid-001');
      expect(result.componentName).toBe('api-service');
      expect(result.workflow?.name).toBe('docker-build');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.getWorkflowRun(
          'test-ns',
          'my-project',
          'api-service',
          'run-001',
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('triggerBuild', () => {
    it('triggers build via new API and transforms response', async () => {
      // First GET: fetch component to resolve workflow name
      const k8sComponent = {
        metadata: { name: 'api-service', namespace: 'test-ns' },
        spec: { workflow: { name: 'docker-build' } },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(k8sComponent));
      // Then POST: create workflow run
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sWorkflowRun));

      const service = createService();
      const result = await service.triggerBuild(
        'test-ns',
        'my-project',
        'api-service',
        'abc1234',
        'token-123',
      );

      expect(result.uuid).toBe('run-uid-001');
      expect(result.componentName).toBe('api-service');
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPOST).toHaveBeenCalledTimes(1);
    });

    it('triggers build without commit', async () => {
      const k8sComponent = {
        metadata: { name: 'api-service', namespace: 'test-ns' },
        spec: { workflow: { name: 'docker-build' } },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(k8sComponent));
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sWorkflowRun));

      const service = createService();
      const result = await service.triggerBuild(
        'test-ns',
        'my-project',
        'api-service',
        undefined,
        'token-123',
      );

      expect(result.uuid).toBe('run-uid-001');
    });

    it('throws on API error when fetching component', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.triggerBuild(
          'test-ns',
          'my-project',
          'api-service',
          'abc1234',
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
