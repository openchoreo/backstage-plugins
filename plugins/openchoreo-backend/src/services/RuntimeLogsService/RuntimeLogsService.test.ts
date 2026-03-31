import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import {
  RuntimeLogsInfoService,
  ObservabilityNotConfiguredError,
} from './RuntimeLogsService';

const mockObsPOST = jest.fn();
const mockResolveForEnvironment = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createObservabilityClientWithUrl: jest.fn(() => ({
    POST: mockObsPOST,
  })),
  ObservabilityUrlResolver: jest.fn().mockImplementation(() => ({
    resolveForEnvironment: mockResolveForEnvironment,
  })),
}));

const mockLogger = mockServices.logger.mock();

function createService() {
  return new RuntimeLogsInfoService(mockLogger, 'http://test:8080');
}

describe('RuntimeLogsInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchRuntimeLogs', () => {
    it('fetches and returns runtime logs', async () => {
      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({
          logs: [{ timestamp: '2025-01-06T10:00:00Z', message: 'test log' }],
          total: 1,
          tookMs: 15,
        }),
      );

      const service = createService();
      const result = await service.fetchRuntimeLogs(
        {
          componentName: 'api-service',
          environmentName: 'dev',
          logLevels: ['INFO', 'ERROR'],
          limit: 100,
        },
        'test-ns',
        'my-project',
        'token-123',
      );

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.tookMs).toBe(15);
      expect(mockResolveForEnvironment).toHaveBeenCalledWith(
        'test-ns',
        'dev',
        'token-123',
      );
    });

    it('returns empty logs when API returns no data', async () => {
      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });
      mockObsPOST.mockResolvedValueOnce(
        createOkResponse({ logs: [], total: 0, tookMs: 5 }),
      );

      const service = createService();
      const result = await service.fetchRuntimeLogs(
        { componentName: 'svc', environmentName: 'dev' },
        'ns',
        'proj',
        'token',
      );

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws ObservabilityNotConfiguredError when no observer URL', async () => {
      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: null,
      });

      const service = createService();
      await expect(
        service.fetchRuntimeLogs(
          { componentName: 'svc', environmentName: 'dev' },
          'ns',
          'proj',
          'token',
        ),
      ).rejects.toThrow(ObservabilityNotConfiguredError);
    });

    it('throws on observability API error', async () => {
      mockResolveForEnvironment.mockResolvedValueOnce({
        observerUrl: 'http://observer:8080',
      });
      mockObsPOST.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchRuntimeLogs(
          { componentName: 'svc', environmentName: 'dev' },
          'ns',
          'proj',
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
