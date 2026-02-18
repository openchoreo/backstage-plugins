import { mockServices } from '@backstage/backend-test-utils';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new PlatformResourceService(mockLogger, 'http://test:8080', useNewApi);
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

describe('PlatformResourceService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getResourceDefinition', () => {
    it('fetches environment via new API', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sEnvironment));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(k8sWorkflow));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(dp));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(pipeline));

      const service = createService(true);
      const result = await service.getResourceDefinition(
        'deploymentpipelines' as any,
        'test-ns',
        'default',
        'token-123',
      );

      expect(result.success).toBe(true);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.getResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          'token',
        ),
      ).rejects.toThrow('Failed to fetch Environment definition');
    });
  });

  describe('updateResourceDefinition', () => {
    it('updates environment via new API PUT', async () => {
      mockPUT.mockResolvedValueOnce(okResponse(k8sEnvironment));

      const service = createService(true);
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
      mockPUT.mockResolvedValueOnce(okResponse(k8sWorkflow));

      const service = createService(true);
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

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.updateResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          k8sEnvironment,
          'token',
        ),
      ).rejects.toThrow('Failed to update Environment definition');
    });
  });

  describe('deleteResourceDefinition', () => {
    it('deletes environment via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService(true);
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

    it('deletes buildplane via new API', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService(true);
      const result = await service.deleteResourceDefinition(
        'buildplanes' as any,
        'test-ns',
        'bp-1',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data?.kind).toBe('BuildPlane');
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: { message: 'fail' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService(true);
      await expect(
        service.deleteResourceDefinition(
          'environments' as any,
          'test-ns',
          'dev',
          'token',
        ),
      ).rejects.toThrow('Failed to delete Environment definition');
    });
  });

  describe('legacy fallback for unsupported kinds', () => {
    it('falls back to legacy for component-types kind', async () => {
      // component-types is NOT in NEW_API_KINDS so it falls back to legacy
      // Legacy uses plain fetch, so we mock global.fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { name: 'go-service' },
          }),
      });

      const service = createService(true);
      const result = await service.getResourceDefinition(
        'component-types' as any,
        'test-ns',
        'go-service',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      global.fetch = originalFetch;
    });
  });
});
