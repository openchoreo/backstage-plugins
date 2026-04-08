import { ObserverUrlCache } from './ObserverUrlCache';

const mockDiscoveryApi = {
  getBaseUrl: jest.fn(),
};

const mockFetchApi = {
  fetch: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockResolvedValue('http://localhost/api/obs');
});

function createCache() {
  return new ObserverUrlCache({
    discoveryApi: mockDiscoveryApi,
    fetchApi: mockFetchApi,
  });
}

function mockOkResponse(data: Record<string, unknown>) {
  return { ok: true, json: () => Promise.resolve(data) };
}

describe('ObserverUrlCache', () => {
  it('fetches and returns URLs on cache miss', async () => {
    mockFetchApi.fetch.mockResolvedValue(
      mockOkResponse({
        observerUrl: 'http://observer',
        rcaAgentUrl: 'http://rca',
      }),
    );
    const cache = createCache();
    const result = await cache.resolveUrls('ns1', 'dev');

    expect(result).toEqual({
      observerUrl: 'http://observer',
      rcaAgentUrl: 'http://rca',
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns cached URLs on subsequent calls within TTL', async () => {
    mockFetchApi.fetch.mockResolvedValue(
      mockOkResponse({ observerUrl: 'http://observer' }),
    );
    const cache = createCache();

    await cache.resolveUrls('ns1', 'dev');
    const result = await cache.resolveUrls('ns1', 'dev');

    expect(result).toEqual({
      observerUrl: 'http://observer',
      rcaAgentUrl: undefined,
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    mockFetchApi.fetch.mockResolvedValue(
      mockOkResponse({ observerUrl: 'http://observer-v1' }),
    );
    const cache = createCache();
    await cache.resolveUrls('ns1', 'dev');

    // Advance past 5-minute TTL
    (Date.now as jest.Mock).mockReturnValue(now + 6 * 60 * 1000);
    mockFetchApi.fetch.mockResolvedValue(
      mockOkResponse({ observerUrl: 'http://observer-v2' }),
    );
    const result = await cache.resolveUrls('ns1', 'dev');

    expect(result.observerUrl).toBe('http://observer-v2');
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(2);

    jest.restoreAllMocks();
  });

  it('throws when response is not OK with JSON error', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Observer not found' }),
    });
    const cache = createCache();

    await expect(cache.resolveUrls('ns1', 'dev')).rejects.toThrow(
      'Observer not found',
    );
  });

  it('throws when response is not OK without JSON', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('not json')),
    });
    const cache = createCache();

    await expect(cache.resolveUrls('ns1', 'dev')).rejects.toThrow(
      'Failed to resolve observer URLs: 502 Bad Gateway',
    );
  });

  it('throws when observerUrl is missing from response', async () => {
    mockFetchApi.fetch.mockResolvedValue(mockOkResponse({}));
    const cache = createCache();

    await expect(cache.resolveUrls('ns1', 'dev')).rejects.toThrow(
      'Observability is not enabled for this component',
    );
  });

  it('caches different namespace/environment combinations separately', async () => {
    mockFetchApi.fetch
      .mockResolvedValueOnce(
        mockOkResponse({ observerUrl: 'http://observer-ns1-dev' }),
      )
      .mockResolvedValueOnce(
        mockOkResponse({ observerUrl: 'http://observer-ns2-prod' }),
      );
    const cache = createCache();

    const result1 = await cache.resolveUrls('ns1', 'dev');
    const result2 = await cache.resolveUrls('ns2', 'prod');

    expect(result1.observerUrl).toBe('http://observer-ns1-dev');
    expect(result2.observerUrl).toBe('http://observer-ns2-prod');
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(2);
  });
});
