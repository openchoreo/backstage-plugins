import { mockServices } from '@backstage/backend-test-utils';
import { WorkloadInfoService } from './WorkloadInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPUT = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: mockPUT,
  })),
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const workloadSpec = {
  containers: [
    {
      name: 'main',
      image: 'registry.example.com/api-service:latest',
      ports: [{ containerPort: 8080, name: 'http' }],
    },
  ],
};

const k8sWorkload = {
  metadata: {
    name: 'api-service-workload',
    namespace: 'test-ns',
  },
  spec: workloadSpec,
  status: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new WorkloadInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('WorkloadInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchWorkloadInfo', () => {
    it('fetches workload via new API and returns spec', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sWorkload] }));

      const service = createService(true);
      const result = await service.fetchWorkloadInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toEqual(workloadSpec);
    });

    it('throws when no workload found', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService(true);
      await expect(
        service.fetchWorkloadInfo(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
          },
          'token',
        ),
      ).rejects.toThrow('Failed to fetch workload info');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchWorkloadInfo(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
          },
          'token',
        ),
      ).rejects.toThrow('Failed to fetch workload info');
    });
  });

  describe('applyWorkload', () => {
    it('GETs existing workload then PUTs updated spec', async () => {
      // First: list workloads
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sWorkload] }));
      // Then: PUT updated workload
      const updatedWorkload = {
        ...k8sWorkload,
        spec: { ...workloadSpec, replicas: 3 },
      };
      mockPUT.mockResolvedValueOnce(okResponse(updatedWorkload));

      const service = createService(true);
      const result = await service.applyWorkload(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
          workloadSpec: { ...workloadSpec, replicas: 3 } as any,
        },
        'token-123',
      );

      expect(result).toEqual({ ...workloadSpec, replicas: 3 });
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('throws when no existing workload found', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService(true);
      await expect(
        service.applyWorkload(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
            workloadSpec: workloadSpec as any,
          },
          'token',
        ),
      ).rejects.toThrow('No existing workload found');
    });

    it('throws when PUT fails', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sWorkload] }));
      mockPUT.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.applyWorkload(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
            workloadSpec: workloadSpec as any,
          },
          'token',
        ),
      ).rejects.toThrow('Failed to update workload');
    });
  });
});
