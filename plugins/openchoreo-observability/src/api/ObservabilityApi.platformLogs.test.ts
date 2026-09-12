import { ObservabilityClient } from './ObservabilityApi';

const resolveUrls = jest.fn();

jest.mock('./ObserverUrlCache', () => ({
  ObserverUrlCache: jest.fn().mockImplementation(() => ({ resolveUrls })),
}));

const mockFetchApi = { fetch: jest.fn() };
const mockDiscoveryApi = { getBaseUrl: jest.fn() };

const createClient = () =>
  new ObservabilityClient({
    discoveryApi: mockDiscoveryApi,
    fetchApi: mockFetchApi,
  });

const okResponse = (data: Record<string, unknown>) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

/** The URL the client was last asked to fetch, parsed. */
const lastRequestUrl = () => new URL(mockFetchApi.fetch.mock.calls[0][0]);

describe('ObservabilityClient.getPlatformLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchApi.fetch.mockResolvedValue(
      okResponse({ logs: [], total: 0, tookMs: 1 }),
    );
  });

  it('calls the observer URL it is given, without resolving an environment', async () => {
    await createClient().getPlatformLogs('http://observer.example');

    expect(lastRequestUrl().origin + lastRequestUrl().pathname).toBe(
      'http://observer.example/api/v1alpha1/platform-logs',
    );
    // Platform logs are not environment-scoped, so the URL cache must not be consulted.
    expect(resolveUrls).not.toHaveBeenCalled();
  });

  it('sends multi-value filters comma-separated', async () => {
    await createClient().getPlatformLogs('http://observer.example', {
      clusterInstances: ['cluster1', 'cluster2'],
      namespaces: ['openchoreo-control-plane'],
      podNames: ['pod-a', 'pod-b'],
      containerNames: ['manager'],
      logLevels: ['ERROR', 'WARN'],
    });

    const params = lastRequestUrl().searchParams;
    expect(params.get('clusterInstance')).toBe('cluster1,cluster2');
    expect(params.get('namespace')).toBe('openchoreo-control-plane');
    expect(params.get('podName')).toBe('pod-a,pod-b');
    expect(params.get('containerName')).toBe('manager');
    expect(params.get('logLevels')).toBe('ERROR,WARN');
  });

  it('omits empty filters instead of sending empty values', async () => {
    await createClient().getPlatformLogs('http://observer.example', {
      clusterInstances: [],
      namespaces: [],
      labels: '',
      searchQuery: '',
    });

    const params = lastRequestUrl().searchParams;
    // An empty list is "not a filter"; sending `namespace=` would be a filter that
    // matches nothing.
    expect(params.has('clusterInstance')).toBe(false);
    expect(params.has('namespace')).toBe(false);
    expect(params.has('labels')).toBe(false);
    expect(params.has('searchPhrase')).toBe(false);
  });

  it('passes the label selector through as written', async () => {
    await createClient().getPlatformLogs('http://observer.example', {
      labels:
        'openchoreo.dev/plane=controlplane,app.kubernetes.io/name=openbao',
    });

    expect(lastRequestUrl().searchParams.get('labels')).toBe(
      'openchoreo.dev/plane=controlplane,app.kubernetes.io/name=openbao',
    );
  });

  it('defaults the time window, limit and sort order', async () => {
    await createClient().getPlatformLogs('http://observer.example');

    const params = lastRequestUrl().searchParams;
    expect(params.get('limit')).toBe('100');
    expect(params.get('sortOrder')).toBe('desc');
    expect(Number.isNaN(Date.parse(params.get('startTime')!))).toBe(false);
    expect(Number.isNaN(Date.parse(params.get('endTime')!))).toBe(false);
  });

  it('returns the parsed response', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({
        logs: [{ timestamp: '2026-08-14T16:31:00Z', log: 'hello' }],
        total: 1,
        tookMs: 4,
      }),
    );

    const result = await createClient().getPlatformLogs(
      'http://observer.example',
    );

    expect(result.total).toBe(1);
    expect(result.logs[0].log).toBe('hello');
  });

  it.each([
    [403, /permission/i],
    [501, /does not support platform logs/i],
  ])(
    'explains a %s rather than surfacing the raw status',
    async (status, expected) => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status,
        statusText: 'nope',
        json: () => Promise.resolve({ message: '' }),
        text: () => Promise.resolve(''),
      });

      await expect(
        createClient().getPlatformLogs('http://observer.example'),
      ).rejects.toThrow(expected);
    },
  );
});
