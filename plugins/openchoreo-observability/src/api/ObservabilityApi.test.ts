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

describe('ObservabilityClient.getFinOpsReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({
      observerUrl: 'http://observer',
      finopsAgentUrl: 'http://finops',
    });
  });

  it('fetches finops reports successfully', async () => {
    const mockReports = [
      {
        reportId: 'r1',
        namespace: 'dev',
        project: 'proj',
        timestamp: '2026-01-01T00:00:00Z',
        status: 'completed',
      },
    ];
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ reports: mockReports, totalCount: 1 }),
    );

    const client = createClient();
    const result = await client.getFinOpsReports('dev', 'proj', 'env1', {
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-02T00:00:00Z',
      limit: 50,
    });

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toContain('/api/v1alpha1/reports');
    expect(url).toContain('namespace=dev');
    expect(url).toContain('project=proj');
    expect(url).toContain('environment=env1');
    expect(url).toContain('limit=50');
    expect(result.reports).toEqual(mockReports);
    expect(result.totalCount).toBe(1);
  });

  it('throws when finopsAgentUrl is not configured', async () => {
    resolveUrls.mockResolvedValue({
      observerUrl: 'http://observer',
      finopsAgentUrl: null,
    });

    const client = createClient();
    await expect(
      client.getFinOpsReports('dev', 'proj', 'env1'),
    ).rejects.toThrow('FinOps service is not configured');
  });

  it('throws when fetch fails with network error', async () => {
    mockFetchApi.fetch.mockRejectedValueOnce(new Error('connection refused'));

    const client = createClient();
    await expect(
      client.getFinOpsReports('dev', 'proj', 'env1'),
    ).rejects.toThrow('FinOps service is unreachable: connection refused');
  });

  it('throws friendly error when response is not ok', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ error: 'internal server error' }),
    });

    const client = createClient();
    await expect(
      client.getFinOpsReports('dev', 'proj', 'env1'),
    ).rejects.toThrow('internal server error');
  });

  it('returns empty reports array when API returns no reports', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ reports: undefined, totalCount: 0 }),
    );

    const client = createClient();
    const result = await client.getFinOpsReports('dev', 'proj', 'env1');
    expect(result.reports).toEqual([]);
  });
});

describe('ObservabilityClient.getFinOpsReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({
      observerUrl: 'http://observer',
      finopsAgentUrl: 'http://finops',
    });
  });

  it('fetches a single finops report successfully', async () => {
    const mockReport = {
      reportId: 'r1',
      namespace: 'dev',
      project: 'proj',
      timestamp: '2026-01-01T00:00:00Z',
      status: 'completed',
      report: null,
    };
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse(mockReport));

    const client = createClient();
    const result = await client.getFinOpsReport('r1', 'env1', 'dev');

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toContain('/api/v1alpha1/reports/r1');
    expect(result).toEqual(mockReport);
  });

  it('throws when finopsAgentUrl is not configured', async () => {
    resolveUrls.mockResolvedValue({
      observerUrl: 'http://observer',
      finopsAgentUrl: null,
    });

    const client = createClient();
    await expect(client.getFinOpsReport('r1', 'env1', 'dev')).rejects.toThrow(
      'FinOps service is not configured',
    );
  });

  it('throws when fetch fails with network error', async () => {
    mockFetchApi.fetch.mockRejectedValueOnce(new Error('timeout'));

    const client = createClient();
    await expect(client.getFinOpsReport('r1', 'env1', 'dev')).rejects.toThrow(
      'FinOps service is unreachable: timeout',
    );
  });

  it('throws not found error', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'FinOps report not found' }),
    });

    const client = createClient();
    await expect(
      client.getFinOpsReport('missing-id', 'env1', 'dev'),
    ).rejects.toThrow('FinOps report not found');
  });

  it('URL-encodes the reportId', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ reportId: 'r1/special' }),
    );

    const client = createClient();
    await client.getFinOpsReport('r1/special', 'env1', 'dev');

    const [url] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toContain('r1%2Fspecial');
  });
});

describe('ObservabilityClient.getRuntimeEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('POSTs to the events query endpoint with the search scope and options', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({
        events: [{ timestamp: 't1', message: 'm1' }],
        total: 1,
      }),
    );

    const client = createClient();
    const result = await client.getRuntimeEvents(
      'ns1',
      'project-a',
      'dev',
      'component-a',
      { limit: 25, sortOrder: 'asc', startTime: 's', endTime: 'e' },
    );

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1/events/query');
    const payload = JSON.parse(options.body);
    expect(payload.limit).toBe(25);
    expect(payload.sortOrder).toBe('asc');
    expect(payload.startTime).toBe('s');
    expect(payload.endTime).toBe('e');
    expect(payload.searchScope).toEqual({
      namespace: 'ns1',
      project: 'project-a',
      component: 'component-a',
      environment: 'dev',
    });
    expect(result).toEqual({
      events: [{ timestamp: 't1', message: 'm1' }],
      total: 1,
    });
  });

  it('omits the component from scope when not provided and defaults options', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ events: [] }));

    const client = createClient();
    await client.getRuntimeEvents('ns1', 'project-a', 'dev');

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.searchScope.component).toBeUndefined();
    expect(payload.limit).toBe(100);
    expect(payload.sortOrder).toBe('desc');
  });

  it('maps the not-configured error to an observability-disabled message', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Observability is not configured for component foo',
        }),
    });

    const client = createClient();
    await expect(
      client.getRuntimeEvents('ns1', 'project-a', 'dev', 'c'),
    ).rejects.toThrow('Observability is not enabled for this component');
  });

  it('throws the parsed error for other failures', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ error: 'kaboom' }),
    });

    const client = createClient();
    await expect(
      client.getRuntimeEvents('ns1', 'project-a', 'dev', 'c'),
    ).rejects.toThrow('kaboom');
  });
});

describe('ObservabilityClient.getRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('POSTs to the runs endpoint with searchScope and options, and maps the response', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({
        runs: [
          {
            jobName: 'job-1',
            status: 'succeeded',
            startTime: '2026-03-05T10:00:00.000Z',
            completionTime: '2026-03-05T10:05:00.000Z',
            eventCount: 3,
            failureReason: null,
            events: [{ reason: 'Created', message: 'ok' }],
          },
        ],
        total: 42,
        tookMs: 12,
      }),
    );

    const client = createClient();
    const result = await client.getRuns(
      'ns1',
      'project-a',
      'dev',
      'component-a',
      {
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
        limit: 25,
        offset: 5,
        sortOrder: 'asc',
      },
    );

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1/scheduled-tasks/runs/query');
    expect(options.method).toBe('POST');
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      startTime: '2026-03-05T09:00:00.000Z',
      endTime: '2026-03-05T10:00:00.000Z',
      limit: 25,
      offset: 5,
      sortOrder: 'asc',
      searchScope: {
        namespace: 'ns1',
        project: 'project-a',
        component: 'component-a',
        environment: 'dev',
      },
    });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toEqual({
      jobName: 'job-1',
      status: 'succeeded',
      startTime: '2026-03-05T10:00:00.000Z',
      completionTime: '2026-03-05T10:05:00.000Z',
      eventCount: 3,
      failureReason: null,
      events: [{ reason: 'Created', message: 'ok' }],
    });
    expect(result.total).toBe(42);
    expect(result.tookMs).toBe(12);
  });

  it('applies defaults for limit / offset / sortOrder when options are omitted', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ runs: [] }));

    const client = createClient();
    await client.getRuns('ns1', 'project-a', 'dev', 'component-a');

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.limit).toBe(20);
    expect(payload.offset).toBe(0);
    expect(payload.sortOrder).toBe('desc');
    expect(typeof payload.startTime).toBe('string');
    expect(typeof payload.endTime).toBe('string');
  });

  it('coerces missing per-run fields to safe defaults', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ runs: [{}], total: undefined }),
    );

    const client = createClient();
    const result = await client.getRuns(
      'ns1',
      'project-a',
      'dev',
      'component-a',
    );

    expect(result.runs[0]).toEqual({
      jobName: '',
      status: 'unknown',
      startTime: '',
      completionTime: undefined,
      eventCount: 0,
      failureReason: undefined,
      events: undefined,
    });
    expect(result.total).toBe(0);
    expect(result.tookMs).toBe(0);
  });

  it('maps the not-configured error to an observability-disabled message', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Observability is not configured for component foo',
        }),
    });

    const client = createClient();
    await expect(
      client.getRuns('ns1', 'project-a', 'dev', 'component-a'),
    ).rejects.toThrow('Observability is not enabled for this component');
  });

  it('throws the parsed error for other failures', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ error: 'runs boom' }),
    });

    const client = createClient();
    await expect(
      client.getRuns('ns1', 'project-a', 'dev', 'component-a'),
    ).rejects.toThrow('runs boom');
  });
});

describe('ObservabilityClient.getRetries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('POSTs to the retries endpoint and omits time bounds when neither option is set', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ retries: [], total: 0, tookMs: 0 }),
    );

    const client = createClient();
    await client.getRetries('job-1', 'ns1', 'project-a', 'dev', 'component-a');

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe(
      'http://observer/api/v1/scheduled-tasks/runs/job-1/retries/query',
    );
    expect(options.method).toBe('POST');
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      searchScope: {
        namespace: 'ns1',
        project: 'project-a',
        component: 'component-a',
        environment: 'dev',
      },
    });
    expect(payload.startTime).toBeUndefined();
    expect(payload.endTime).toBeUndefined();
  });

  it('includes both time bounds when both are provided', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ retries: [] }));

    const client = createClient();
    await client.getRetries('job-1', 'ns1', 'project-a', 'dev', 'component-a', {
      startTime: '2026-03-05T09:00:00.000Z',
      endTime: '2026-03-05T10:00:00.000Z',
    });

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.startTime).toBe('2026-03-05T09:00:00.000Z');
    expect(payload.endTime).toBe('2026-03-05T10:00:00.000Z');
  });

  it('omits time bounds when only startTime is provided (both-or-none)', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ retries: [] }));

    const client = createClient();
    await client.getRetries('job-1', 'ns1', 'project-a', 'dev', 'component-a', {
      startTime: '2026-03-05T09:00:00.000Z',
    });

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.startTime).toBeUndefined();
    expect(payload.endTime).toBeUndefined();
  });

  it('omits time bounds when only endTime is provided (both-or-none)', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ retries: [] }));

    const client = createClient();
    await client.getRetries('job-1', 'ns1', 'project-a', 'dev', 'component-a', {
      endTime: '2026-03-05T10:00:00.000Z',
    });

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.startTime).toBeUndefined();
    expect(payload.endTime).toBeUndefined();
  });

  it('URL-encodes the jobName', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ retries: [] }));

    const client = createClient();
    await client.getRetries(
      'job/with slashes',
      'ns1',
      'project-a',
      'dev',
      'component-a',
    );

    const [url] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toContain('job%2Fwith%20slashes');
  });

  it('maps response retries with default fields', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({
        retries: [
          {
            podName: 'pod-1',
            status: 'Succeeded',
            startTime: '2026-03-05T10:00:00.000Z',
            eventCount: 2,
            events: [],
          },
          {},
        ],
        total: 2,
        tookMs: 7,
      }),
    );

    const client = createClient();
    const result = await client.getRetries(
      'job-1',
      'ns1',
      'project-a',
      'dev',
      'component-a',
    );

    expect(result.retries).toEqual([
      {
        podName: 'pod-1',
        status: 'Succeeded',
        startTime: '2026-03-05T10:00:00.000Z',
        eventCount: 2,
        events: [],
      },
      {
        podName: '',
        status: 'Unknown',
        startTime: '',
        eventCount: 0,
        events: undefined,
      },
    ]);
    expect(result.total).toBe(2);
    expect(result.tookMs).toBe(7);
  });

  it('throws the parsed error when the response is not ok', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ error: 'retries boom' }),
    });

    const client = createClient();
    await expect(
      client.getRetries('job-1', 'ns1', 'project-a', 'dev', 'component-a'),
    ).rejects.toThrow('retries boom');
  });
});

describe('ObservabilityClient.getPodLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('POSTs to the logs endpoint with the pod name in searchScope', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      mockOkResponse({ logs: [{ timestamp: 't1', message: 'hello' }] }),
    );

    const client = createClient();
    const result = await client.getPodLogs(
      'pod-1',
      'ns1',
      'project-a',
      'dev',
      'component-a',
      {
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
        limit: 100,
        sortOrder: 'desc',
      },
    );

    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1/logs/query');
    expect(options.method).toBe('POST');
    const payload = JSON.parse(options.body);
    expect(payload.startTime).toBe('2026-03-05T09:00:00.000Z');
    expect(payload.endTime).toBe('2026-03-05T10:00:00.000Z');
    expect(payload.limit).toBe(100);
    expect(payload.sortOrder).toBe('desc');
    expect(payload.searchScope).toEqual({
      namespace: 'ns1',
      project: 'project-a',
      component: 'component-a',
      environment: 'dev',
      podName: 'pod-1',
    });
    expect(result).toEqual({
      logs: [{ timestamp: 't1', message: 'hello' }],
    });
  });

  it('applies default limit/sortOrder and default start/end when no options given', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(mockOkResponse({ logs: [] }));

    const client = createClient();
    await client.getPodLogs('pod-1', 'ns1', 'project-a', 'dev', 'component-a');

    const payload = JSON.parse(mockFetchApi.fetch.mock.calls[0][1].body);
    expect(payload.limit).toBe(500);
    expect(payload.sortOrder).toBe('asc');
    expect(typeof payload.startTime).toBe('string');
    expect(typeof payload.endTime).toBe('string');
  });

  it('throws the parsed error when the response is not ok', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ error: 'pod logs boom' }),
    });

    const client = createClient();
    await expect(
      client.getPodLogs('pod-1', 'ns1', 'project-a', 'dev', 'component-a'),
    ).rejects.toThrow('pod logs boom');
  });
});
