import { mockServices } from '@backstage/backend-test-utils';
import { ComponentInfoService } from './ComponentInfoService';

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
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
    PATCH: jest.fn(),
    DELETE: mockDELETE,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'api-service',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'API Service',
    'openchoreo.dev/description': 'A test component',
  },
};

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const k8sComponent = {
  metadata: baseMeta,
  spec: {
    owner: { projectName: 'my-project' },
    type: 'Service',
    componentType: 'deployment/go-service',
    autoDeploy: true,
    workflow: {
      name: 'docker-build',
      systemParameters: {
        repository: {
          url: 'https://github.com/org/repo.git',
          revision: { branch: 'main', commit: 'abc1234' },
          appPath: './services/api',
        },
      },
      parameters: { dockerfile: 'Dockerfile' },
    },
  },
  status: { conditions: [readyCondition] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new ComponentInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('ComponentInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchComponentDetails', () => {
    it('calls new API endpoint and transforms response', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));

      const service = createService(true);
      const result = await service.fetchComponentDetails(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result.name).toBe('api-service');
      expect(result.namespaceName).toBe('test-ns');
      expect(result.projectName).toBe('my-project');
      expect(result.type).toBe('Service');
      expect(result.autoDeploy).toBe(true);
      expect(result.uid).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchComponentDetails(
          'test-ns',
          'my-project',
          'api-service',
          'token-123',
        ),
      ).rejects.toThrow('Failed to fetch component');
    });
  });

  describe('patchComponent', () => {
    it('GETs existing component then PUTs with updated autoDeploy', async () => {
      // First GET returns existing component
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));
      // Then PUT returns updated component
      const updatedComponent = {
        ...k8sComponent,
        spec: { ...k8sComponent.spec, autoDeploy: false },
      };
      mockPUT.mockResolvedValueOnce(okResponse(updatedComponent));

      const service = createService(true);
      const result = await service.patchComponent(
        'test-ns',
        'my-project',
        'api-service',
        false,
        'token-123',
      );

      expect(result.autoDeploy).toBe(false);
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('throws when GET fails', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.patchComponent(
          'test-ns',
          'my-project',
          'api-service',
          false,
          'token-123',
        ),
      ).rejects.toThrow('Failed to fetch component for patch');
    });

    it('throws when PUT fails', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));
      mockPUT.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.patchComponent(
          'test-ns',
          'my-project',
          'api-service',
          false,
          'token-123',
        ),
      ).rejects.toThrow('Failed to patch component');
    });
  });

  describe('deleteComponent', () => {
    it('calls new API DELETE endpoint', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService(true);
      await service.deleteComponent(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: { message: 'fail' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService(true);
      await expect(
        service.deleteComponent(
          'test-ns',
          'my-project',
          'api-service',
          'token-123',
        ),
      ).rejects.toThrow('Failed to delete component');
    });
  });
});
