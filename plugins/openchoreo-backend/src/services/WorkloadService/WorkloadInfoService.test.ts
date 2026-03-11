import { mockServices } from '@backstage/backend-test-utils';
import { WorkloadInfoService } from './WorkloadInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPUT = jest.fn();
const mockPOST = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: mockPUT,
    POST: mockPOST,
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

function createService() {
  return new WorkloadInfoService(mockLogger, 'http://test:8080');
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

describe('WorkloadInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchWorkloadInfo', () => {
    it('fetches workload and returns full resource', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sWorkload] }));

      const service = createService();
      const result = await service.fetchWorkloadInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token-123',
      );

      expect(result).toEqual(k8sWorkload);
    });

    it('returns null when no workload found', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService();
      const result = await service.fetchWorkloadInfo(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
        },
        'token',
      );

      expect(result).toBeNull();
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService();
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
    it('PUTs the full resource when isNew is false', async () => {
      const updatedWorkload = {
        ...k8sWorkload,
        spec: { ...workloadSpec, replicas: 3 },
      };
      mockPUT.mockResolvedValueOnce(okResponse(updatedWorkload));

      const service = createService();
      const result = await service.applyWorkload(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
          workload: updatedWorkload as any,
          isNew: false,
        },
        'token-123',
      );

      expect(result).toEqual(updatedWorkload);
      expect(mockPUT).toHaveBeenCalledTimes(1);
      expect(mockPOST).not.toHaveBeenCalled();
    });

    it('POSTs a new workload when isNew is true', async () => {
      const newWorkload = {
        metadata: { name: 'api-service' },
        spec: workloadSpec,
      } as any;
      const createdWorkload = {
        metadata: { name: 'api-service-workload' },
        spec: workloadSpec,
      };
      mockPOST.mockResolvedValueOnce(okResponse(createdWorkload));

      const service = createService();
      const result = await service.applyWorkload(
        {
          projectName: 'my-project',
          componentName: 'api-service',
          namespaceName: 'test-ns',
          workload: newWorkload,
          isNew: true,
        },
        'token',
      );

      expect(result).toEqual(createdWorkload);
      expect(mockPOST).toHaveBeenCalledTimes(1);
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('throws when PUT fails', async () => {
      mockPUT.mockResolvedValueOnce(errorResponse());

      const service = createService();
      await expect(
        service.applyWorkload(
          {
            projectName: 'my-project',
            componentName: 'api-service',
            namespaceName: 'test-ns',
            workload: k8sWorkload as any,
            isNew: false,
          },
          'token',
        ),
      ).rejects.toThrow('Failed to apply workload');
    });
  });
});
