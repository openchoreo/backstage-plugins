import { ObservabilityClient } from './ObservabilityApi';

const resolveUrls = jest.fn();

jest.mock('./ObserverUrlCache', () => ({
  ObserverUrlCache: jest.fn().mockImplementation(() => ({
    resolveUrls,
  })),
}));

const mockFetchApi = {
  fetch: jest.fn(),
};

const mockDiscoveryApi = {
  getBaseUrl: jest.fn(),
};

function createClient() {
  return new ObservabilityClient({
    discoveryApi: mockDiscoveryApi,
    fetchApi: mockFetchApi,
  });
}

function mockOkResponse(data: Record<string, unknown>) {
  return { ok: true, json: () => Promise.resolve(data) };
}

describe('ObservabilityClient.getMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('fetches resource metrics by default', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({
        cpuUsage: [{ timestamp: 't1', value: 1 }],
        cpuRequests: [{ timestamp: 't2', value: 2 }],
        cpuLimits: [{ timestamp: 't3', value: 3 }],
        memoryUsage: [{ timestamp: 't4', value: 4 }],
        memoryRequests: [{ timestamp: 't5', value: 5 }],
        memoryLimits: [{ timestamp: 't6', value: 6 }],
      }),
    );

    const client = createClient();
    const result = await client.getMetrics(
      'dev',
      'component-a',
      'ns1',
      'project-a',
    );

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1/metrics/query');
    const payload = JSON.parse(options.body);
    expect(payload.metric).toBe('resource');
    expect(payload.searchScope).toEqual({
      namespace: 'ns1',
      project: 'project-a',
      component: 'component-a',
      environment: 'dev',
    });
    expect(result).toEqual({
      cpuUsage: {
        cpuUsage: [{ timestamp: 't1', value: 1 }],
        cpuRequests: [{ timestamp: 't2', value: 2 }],
        cpuLimits: [{ timestamp: 't3', value: 3 }],
      },
      memoryUsage: {
        memoryUsage: [{ timestamp: 't4', value: 4 }],
        memoryRequests: [{ timestamp: 't5', value: 5 }],
        memoryLimits: [{ timestamp: 't6', value: 6 }],
      },
    });
  });

  it('fetches http metrics when requested and defaults missing series', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({
        requestCount: [{ timestamp: 't1', value: 10 }],
        meanLatency: [{ timestamp: 't2', value: 0.5 }],
      }),
    );

    const client = createClient();
    const result = await client.getMetrics(
      'dev',
      'component-a',
      'ns1',
      'project-a',
      {
        type: 'http',
        step: '5m',
        startTime: '2026-03-05T10:00:00.000Z',
        endTime: '2026-03-05T11:00:00.000Z',
      },
    );

    const [, options] = mockFetchApi.fetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.metric).toBe('http');
    expect(payload.step).toBe('5m');
    expect(payload.startTime).toBe('2026-03-05T10:00:00.000Z');
    expect(payload.endTime).toBe('2026-03-05T11:00:00.000Z');

    expect(result).toEqual({
      networkThroughput: {
        requestCount: [{ timestamp: 't1', value: 10 }],
        successfulRequestCount: [],
        unsuccessfulRequestCount: [],
      },
      networkLatency: {
        meanLatency: [{ timestamp: 't2', value: 0.5 }],
        latencyP50: [],
        latencyP90: [],
        latencyP99: [],
      },
    });
  });

  it('throws a friendly error when observability is not enabled', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () =>
        Promise.resolve({
          error: 'Observability is not configured for component',
        }),
    });

    const client = createClient();
    await expect(
      client.getMetrics('dev', 'component-a', 'ns1', 'project-a'),
    ).rejects.toThrow('Observability is not enabled for this component');
  });

  it('throws for unsupported metric types', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({}));

    const client = createClient();
    await expect(
      client.getMetrics('dev', 'component-a', 'ns1', 'project-a', {
        type: 'unknown' as 'resource',
      }),
    ).rejects.toThrow('Unsupported metric type: unknown');
  });
});
