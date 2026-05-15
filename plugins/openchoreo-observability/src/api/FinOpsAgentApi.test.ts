import { FinOpsAgentClient } from './FinOpsAgentApi';

const mockResolveUrls = jest.fn();

jest.mock('./ObserverUrlCache', () => ({
  ObserverUrlCache: jest.fn().mockImplementation(() => ({
    resolveUrls: mockResolveUrls,
  })),
}));

const mockFetchApi = { fetch: jest.fn() };
const mockDiscoveryApi = { getBaseUrl: jest.fn() };

function createClient() {
  return new FinOpsAgentClient({
    discoveryApi: mockDiscoveryApi as any,
    fetchApi: mockFetchApi as any,
  });
}

const routing = { namespaceName: 'dev', environmentName: 'development' };

describe('FinOpsAgentClient.updateActionStatuses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveUrls.mockResolvedValue({
      finopsAgentUrl: 'http://finops-agent',
    });
    mockFetchApi.fetch.mockResolvedValue({ ok: true } as Response);
  });

  it('calls the correct PUT endpoint', async () => {
    await createClient().updateActionStatuses('rep-1', routing, {
      appliedIndices: [0],
    });

    expect(mockFetchApi.fetch).toHaveBeenCalledWith(
      'http://finops-agent/api/v1alpha1/reports/rep-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('sends appliedIndices in the request body as JSON', async () => {
    await createClient().updateActionStatuses('rep-1', routing, {
      appliedIndices: [0, 2],
    });

    const [, opts] = mockFetchApi.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ appliedIndices: [0, 2] });
  });

  it('sends dismissedIndices in the request body as JSON', async () => {
    await createClient().updateActionStatuses('rep-1', routing, {
      dismissedIndices: [1],
    });

    const [, opts] = mockFetchApi.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ dismissedIndices: [1] });
  });

  it('includes the x-openchoreo-direct header', async () => {
    await createClient().updateActionStatuses('rep-1', routing, {});

    const [, opts] = mockFetchApi.fetch.mock.calls[0];
    expect(opts.headers['x-openchoreo-direct']).toBe('true');
  });

  it('URL-encodes the report ID', async () => {
    await createClient().updateActionStatuses('report/with/slashes', routing, {
      appliedIndices: [0],
    });

    const [url] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toContain('report%2Fwith%2Fslashes');
  });

  it('resolves the URL using the routing namespace and environment', async () => {
    await createClient().updateActionStatuses('rep-1', routing, {});

    expect(mockResolveUrls).toHaveBeenCalledWith('dev', 'development');
  });

  it('throws when the finops service is not configured', async () => {
    mockResolveUrls.mockResolvedValue({ finopsAgentUrl: undefined });

    await expect(
      createClient().updateActionStatuses('rep-1', routing, {}),
    ).rejects.toThrow('FinOps service is not configured');
  });

  it('throws with the error detail from a non-OK response', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: 'Invalid action indices' }),
    } as any);

    await expect(
      createClient().updateActionStatuses('rep-1', routing, {
        appliedIndices: [99],
      }),
    ).rejects.toThrow('Invalid action indices');
  });

  it('falls back to statusText when response body has no detail field', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({}),
    } as any);

    await expect(
      createClient().updateActionStatuses('rep-1', routing, {}),
    ).rejects.toThrow('Update report failed: Service Unavailable');
  });
});
