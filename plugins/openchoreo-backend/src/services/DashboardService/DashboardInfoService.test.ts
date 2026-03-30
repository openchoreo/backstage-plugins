import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
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
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new DashboardInfoService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDashboardMetrics', () => {
    it('returns binding count from new API', async () => {
      const bindings = [
        { metadata: { name: 'comp-dev' } },
        { metadata: { name: 'comp-staging' } },
      ];
      mockGET.mockResolvedValueOnce(createOkResponse({ items: bindings }));

      const service = createService();
      const result = await service.fetchDashboardMetrics(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toBe(2);
    });

    it('returns 0 when no bindings exist', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));

      const service = createService();
      const result = await service.fetchDashboardMetrics(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toBe(0);
    });

    it('returns 0 on API error (does not throw)', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
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
        createOkResponse({ items: [{ metadata: {} }, { metadata: {} }] }),
      );
      // Second component: 1 binding
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [{ metadata: {} }] }));

      const service = createService();
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
