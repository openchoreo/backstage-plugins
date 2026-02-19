import { mockServices } from '@backstage/backend-test-utils';
import { DashboardInfoService } from './DashboardInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new DashboardInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('DashboardInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDashboardMetrics', () => {
    it('returns binding count from new API', async () => {
      const bindings = [
        { metadata: { name: 'comp-dev' } },
        { metadata: { name: 'comp-staging' } },
      ];
      mockGET.mockResolvedValueOnce(okResponse({ items: bindings }));

      const service = createService(true);
      const result = await service.fetchDashboardMetrics(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toBe(2);
    });

    it('returns 0 when no bindings exist', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService(true);
      const result = await service.fetchDashboardMetrics(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toBe(0);
    });

    it('returns 0 on API error (does not throw)', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      const result = await service.fetchDashboardMetrics(
        'test-ns',
        'my-project',
        'api-service',
        'token',
      );

      expect(result).toBe(0);
    });
  });

  describe('fetchComponentsBindingsCount', () => {
    it('sums binding counts across multiple components', async () => {
      // First component: 2 bindings
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [{ metadata: {} }, { metadata: {} }] }),
      );
      // Second component: 1 binding
      mockGET.mockResolvedValueOnce(okResponse({ items: [{ metadata: {} }] }));

      const service = createService(true);
      const result = await service.fetchComponentsBindingsCount(
        [
          {
            namespaceName: 'test-ns',
            projectName: 'proj-1',
            componentName: 'comp-1',
          },
          {
            namespaceName: 'test-ns',
            projectName: 'proj-1',
            componentName: 'comp-2',
          },
        ],
        'token-123',
      );

      expect(result).toBe(3);
    });
  });
});
