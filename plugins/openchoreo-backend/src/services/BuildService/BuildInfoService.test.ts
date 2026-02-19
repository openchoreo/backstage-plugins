import { mockServices } from '@backstage/backend-test-utils';
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
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
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
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Run 001',
    'openchoreo.dev/description': 'Test run',
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
      systemParameters: {
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

function createService(useNewApi = true) {
  return new BuildInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('BuildInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchBuilds', () => {
    it('fetches builds via new API and transforms results', async () => {
      // fetchAllPages mock calls fetchPage once, returns items
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sWorkflowRun], pagination: {} }),
      );

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchBuilds('test-ns', 'my-project', 'api-service', 'token'),
      ).rejects.toThrow('Failed to fetch component workflow runs');
    });
  });

  describe('getWorkflowRun', () => {
    it('fetches single run via new API and transforms', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sWorkflowRun));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.getWorkflowRun(
          'test-ns',
          'my-project',
          'api-service',
          'run-001',
          'token',
        ),
      ).rejects.toThrow('Failed to fetch workflow run');
    });
  });

  describe('triggerBuild', () => {
    it('triggers build via new API and transforms response', async () => {
      mockPOST.mockResolvedValueOnce(okResponse(k8sWorkflowRun));

      const service = createService(true);
      const result = await service.triggerBuild(
        'test-ns',
        'my-project',
        'api-service',
        'abc1234',
        'token-123',
      );

      expect(result.uuid).toBe('run-uid-001');
      expect(result.componentName).toBe('api-service');
      expect(mockPOST).toHaveBeenCalledTimes(1);
    });

    it('triggers build without commit', async () => {
      mockPOST.mockResolvedValueOnce(okResponse(k8sWorkflowRun));

      const service = createService(true);
      const result = await service.triggerBuild(
        'test-ns',
        'my-project',
        'api-service',
        undefined,
        'token-123',
      );

      expect(result.uuid).toBe('run-uid-001');
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.triggerBuild(
          'test-ns',
          'my-project',
          'api-service',
          'abc1234',
          'token',
        ),
      ).rejects.toThrow('Failed to create component workflow run');
    });
  });
});
