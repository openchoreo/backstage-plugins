import { GenericWorkflowsClient } from './GenericWorkflowsClient';

describe('GenericWorkflowsClient', () => {
  let client: GenericWorkflowsClient;
  let mockFetchApi: any;
  let mockDiscoveryApi: any;

  beforeEach(() => {
    mockFetchApi = {
      fetch: jest.fn(),
    };
    mockDiscoveryApi = {
      getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/openchoreo'),
    };

    client = new GenericWorkflowsClient(mockDiscoveryApi, mockFetchApi);
  });

  describe('apiFetch', () => {
    it('should return undefined for 204 No Content', async () => {
      mockFetchApi.fetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: jest.fn().mockImplementation(() => Promise.reject(new Error('Should not be called'))),
      });

      const result = await client.deleteWorkflowRun('dev-ns', 'run-1');
      
      expect(result).toBeUndefined();
      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/openchoreo/workflow-runs/run-1?namespaceName=dev-ns',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should parse json for 200 OK', async () => {
      mockFetchApi.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ name: 'run-1' }),
      });

      const result = await client.getWorkflowRun('dev-ns', 'run-1');
      
      expect(result).toEqual({ name: 'run-1' });
    });
  });
});
