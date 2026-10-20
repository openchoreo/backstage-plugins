import {
  CostsReleaseLineNotSupportedError,
  ObservabilityClient,
} from './ObservabilityApi';

const resolveUrls = jest.fn();

jest.mock('./ObserverUrlCache', () => ({
  ObserverUrlCache: jest.fn().mockImplementation(() => ({
    resolveUrls,
  })),
}));

const mockFetchApi = { fetch: jest.fn() };
const mockDiscoveryApi = { getBaseUrl: jest.fn() };

function createClient() {
  return new ObservabilityClient({
    discoveryApi: mockDiscoveryApi as any,
    fetchApi: mockFetchApi as any,
  });
}

const okResponse = (data: Record<string, unknown>) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

describe('ObservabilityClient cost APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('builds the environment-scoped cost URL with query params', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({ items: [{ component: 'c', cpuCost: 1, memoryCost: 2 }] }),
    );

    const client = createClient();
    const result = await client.getCosts('ns1', 'dev', {
      project: 'proj',
      component: 'comp',
      startTime: '2026-07-01T00:00:00.000Z',
      endTime: '2026-07-01T01:00:00.000Z',
      granularity: '1h',
    });

    expect(resolveUrls).toHaveBeenCalledWith('ns1', 'dev');
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(
      '/api/v1alpha1/costs/namespaces/ns1/environments/dev',
    );
    expect(parsed.searchParams.get('project')).toBe('proj');
    expect(parsed.searchParams.get('component')).toBe('comp');
    expect(parsed.searchParams.get('startTime')).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(parsed.searchParams.get('endTime')).toBe('2026-07-01T01:00:00.000Z');
    expect(parsed.searchParams.get('granularity')).toBe('1h');
    expect(options.headers['x-openchoreo-direct']).toBe('true');
    expect(result.items).toHaveLength(1);
  });

  it('omits optional params when not provided', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(okResponse({ items: [] }));

    const client = createClient();
    await client.getCosts('ns1', 'dev', {
      startTime: 's',
      endTime: 'e',
    });

    const [url] = mockFetchApi.fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.has('project')).toBe(false);
    expect(parsed.searchParams.has('granularity')).toBe(false);
  });

  it('builds the recommendations URL', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({
        items: [
          {
            component: 'comp',
            environment: 'dev',
            current: { cpuCost: 2, memoryCost: 3 },
            recommendation: { cpuCost: 1, memoryCost: 1 },
          },
        ],
      }),
    );

    const client = createClient();
    const result = await client.getCostRecommendations('ns1', 'dev', {
      project: 'proj',
      component: 'comp',
      startTime: 's',
      endTime: 'e',
    });

    const [url] = mockFetchApi.fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(
      '/api/v1alpha1/costs/namespaces/ns1/environments/dev/recommendations',
    );
    expect(parsed.searchParams.get('project')).toBe('proj');
    expect(parsed.searchParams.get('component')).toBe('comp');
    expect(parsed.searchParams.get('startTime')).toBe('s');
    expect(parsed.searchParams.get('endTime')).toBe('e');
    expect(result.items[0].recommendation.cpuCost).toBe(1);
  });

  it('surfaces the "not enabled" message on the observability error', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({
          error: 'Observability is not configured for component',
        }),
    });

    const client = createClient();
    await expect(client.getCosts('ns1', 'dev')).rejects.toThrow(
      'Observability is not enabled for this component',
    );
  });

  it('throws the parsed error for a generic cost failure', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'boom' }),
    });

    const client = createClient();
    await expect(client.getCosts('ns1', 'dev')).rejects.toThrow('boom');
  });

  it('defaults cost items to an empty array when the body omits them', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(okResponse({}));

    const client = createClient();
    const result = await client.getCosts('ns1', 'dev', {
      startTime: 's',
      endTime: 'e',
    });
    expect(result.items).toEqual([]);
  });

  it('omits optional params on the recommendations URL', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(okResponse({ items: [] }));

    const client = createClient();
    await client.getCostRecommendations('ns1', 'dev', {
      startTime: 's',
      endTime: 'e',
    });

    const [url] = mockFetchApi.fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.has('project')).toBe(false);
    expect(parsed.searchParams.has('component')).toBe(false);
  });

  it('surfaces the "not enabled" message on a recommendations error', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({
          error: 'Observability is not configured for component',
        }),
    });

    const client = createClient();
    await expect(client.getCostRecommendations('ns1', 'dev')).rejects.toThrow(
      'Observability is not enabled for this component',
    );
  });

  it('throws the parsed error for a generic recommendations failure', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'rec-boom' }),
    });

    const client = createClient();
    await expect(client.getCostRecommendations('ns1', 'dev')).rejects.toThrow(
      'rec-boom',
    );
  });
});

describe('ObservabilityClient cost APIs with a release line', () => {
  const notImplemented = {
    ok: false,
    status: 501,
    statusText: 'Not Implemented',
    json: () => Promise.resolve({ error: 'not implemented' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it.each([
    [
      'getCosts',
      (c: ObservabilityClient, o: any) => c.getCosts('ns1', 'dev', o),
    ],
    [
      'getCostRecommendations',
      (c: ObservabilityClient, o: any) =>
        c.getCostRecommendations('ns1', 'dev', o),
    ],
  ])('%s sends the release line with a component', async (_name, call) => {
    mockFetchApi.fetch.mockResolvedValueOnce(okResponse({ items: [] }));

    await call(createClient(), {
      project: 'proj',
      component: 'comp',
      releaseLine: 'main',
    });

    const parsed = new URL(mockFetchApi.fetch.mock.calls[0][0]);
    expect(parsed.searchParams.get('releaseLine')).toBe('main');
  });

  it.each([
    [
      'getCosts',
      (c: ObservabilityClient, o: any) => c.getCosts('ns1', 'dev', o),
    ],
    [
      'getCostRecommendations',
      (c: ObservabilityClient, o: any) =>
        c.getCostRecommendations('ns1', 'dev', o),
    ],
  ])('%s drops the release line without a component', async (_name, call) => {
    mockFetchApi.fetch.mockResolvedValueOnce(okResponse({ items: [] }));

    await call(createClient(), { project: 'proj', releaseLine: 'main' });

    const parsed = new URL(mockFetchApi.fetch.mock.calls[0][0]);
    expect(parsed.searchParams.has('releaseLine')).toBe(false);
  });

  it.each([
    [
      'getCosts',
      (c: ObservabilityClient, o: any) => c.getCosts('ns1', 'dev', o),
    ],
    [
      'getCostRecommendations',
      (c: ObservabilityClient, o: any) =>
        c.getCostRecommendations('ns1', 'dev', o),
    ],
  ])(
    '%s reports a 501 for a release line as not supported',
    async (_name, call) => {
      mockFetchApi.fetch.mockResolvedValueOnce(notImplemented);

      const result = call(createClient(), {
        project: 'proj',
        component: 'comp',
        releaseLine: 'main',
      });
      await expect(result).rejects.toBeInstanceOf(
        CostsReleaseLineNotSupportedError,
      );
      await expect(result).rejects.toThrow(
        'Cost data for a single release line is not supported by the installed FinOps module',
      );
    },
  );

  it('keeps the generic error for a 501 without a release line', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(notImplemented);

    await expect(
      createClient().getCosts('ns1', 'dev', { component: 'comp' }),
    ).rejects.toThrow('not implemented');
  });
});
