import { OpenChoreoCiClient } from './OpenChoreoCiClient';

describe('OpenChoreoCiClient', () => {
  let client: OpenChoreoCiClient;
  let mockFetchApi: any;
  let mockDiscoveryApi: any;

  beforeEach(() => {
    mockFetchApi = {
      fetch: jest.fn(),
    };
    mockDiscoveryApi = {
      getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/openchoreo'),
    };

    client = new OpenChoreoCiClient(mockDiscoveryApi, mockFetchApi);
  });

  describe('apiFetch', () => {
    it('should return undefined for 204 No Content', async () => {
      mockFetchApi.fetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: jest.fn().mockImplementation(() => Promise.reject(new Error('Should not be called'))),
      });

      // We access the private apiFetch method indirectly through a public method
      // that calls it, like deleteWorkflowRun
      const result = await client.deleteWorkflowRun('dev-ns', 'my-project', 'api-service', 'build-2');
      
      expect(result).toBeUndefined();
      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/openchoreo/workflow-run?namespaceName=dev-ns&projectName=my-project&componentName=api-service&runName=build-2',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should parse json for 200 OK', async () => {
      mockFetchApi.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ name: 'build-2' }),
      });

      const result = await client.fetchWorkflowSchema('dev-ns', 'my-workflow');
      
      expect(result).toEqual({ name: 'build-2' });
    });
  });
});
