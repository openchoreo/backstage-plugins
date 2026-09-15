import { ObservabilityClient } from './ObservabilityApi';
import {
  AuditFilterValuesNotSupportedError,
  AuditLogsForbiddenError,
  AuditLogsNotSupportedError,
} from './AuditLogsErrors';

const resolvePlatformUrls = jest.fn();

jest.mock('./ObserverUrlCache', () => ({
  ObserverUrlCache: jest.fn().mockImplementation(() => ({
    resolveUrls: jest.fn(),
    resolvePlatformUrls,
  })),
}));

const mockFetchApi = { fetch: jest.fn() };
const mockDiscoveryApi = { getBaseUrl: jest.fn() };

function createClient() {
  return new ObservabilityClient({
    discoveryApi: mockDiscoveryApi,
    fetchApi: mockFetchApi,
  });
}

const okResponse = (data: Record<string, unknown>) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (
  status: number,
  body: Record<string, unknown> = {},
  statusText = '',
) => ({
  ok: false,
  status,
  statusText,
  json: () => Promise.resolve(body),
});

const WINDOW = {
  startTime: '2026-09-01T00:00:00.000Z',
  endTime: '2026-09-08T00:00:00.000Z',
};

describe('ObservabilityClient.queryAuditLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolvePlatformUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('posts the filter set to the observer and returns the response', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({
        records: [{ event_id: 'e1' }],
        total: 1,
        tookMs: 4,
      }),
    );

    const client = createClient();
    const result = await client.queryAuditLogs({
      ...WINDOW,
      limit: 100,
      result: ['denied'],
      actor: { id: ['alice@example.com'] },
    });

    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1alpha1/audit-logs/query');
    expect(options.method).toBe('POST');
    // The direct-mode header is what swaps in the user's IdP token, which the
    // observer needs to evaluate auditlogs:view.
    expect(options.headers['x-openchoreo-direct']).toBe('true');
    expect(JSON.parse(options.body)).toEqual({
      ...WINDOW,
      limit: 100,
      result: ['denied'],
      actor: { id: ['alice@example.com'] },
    });
    expect(result.total).toBe(1);
  });

  it('reports a 501 as the trail not being served, not as an empty result', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      errorResponse(501, {
        title: 'notImplemented',
        message: 'audit logs are not supported by this adapter',
      }),
    );

    await expect(createClient().queryAuditLogs(WINDOW)).rejects.toThrow(
      AuditLogsNotSupportedError,
    );
  });

  it('surfaces a 400 carrying the observer own message', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      errorResponse(400, {
        message: 'endTime must be strictly after startTime',
      }),
    );

    const error = await createClient()
      .queryAuditLogs(WINDOW)
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AuditLogsNotSupportedError);
    expect(error).not.toBeInstanceOf(AuditLogsForbiddenError);
    expect((error as Error).message).toBe(
      'endTime must be strictly after startTime',
    );
  });

  it('reports a 403 as a permission failure', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      errorResponse(403, { message: 'forbidden' }),
    );

    await expect(createClient().queryAuditLogs(WINDOW)).rejects.toThrow(
      AuditLogsForbiddenError,
    );
  });

  it('falls back to the status when the body is not JSON', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(createClient().queryAuditLogs(WINDOW)).rejects.toThrow(
      'Failed to query the audit trail: 502 Bad Gateway',
    );
  });
});

describe('ObservabilityClient.queryAuditLogFilterValues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolvePlatformUrls.mockResolvedValue({ observerUrl: 'http://observer' });
  });

  it('asks for one filter at a time, under the query it is given', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({
        filter: 'actor.id',
        values: [{ value: 'alice@example.com', count: 12 }],
        totalValues: 1,
        tookMs: 2,
      }),
    );

    const result = await createClient().queryAuditLogFilterValues({
      query: { ...WINDOW, result: ['denied'] },
      filter: 'actor.id',
      valueSearch: 'ali',
      maxValues: 100,
    });

    const [url, options] = mockFetchApi.fetch.mock.calls[0];
    expect(url).toBe('http://observer/api/v1alpha1/audit-logs/filter-values');
    const payload = JSON.parse(options.body);
    expect(payload.filter).toBe('actor.id');
    expect(payload.valueSearch).toBe('ali');
    expect(payload.query.result).toEqual(['denied']);
    expect(result.values[0].count).toBe(12);
  });

  it('reports a 501 as this filter having no pick list', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      errorResponse(501, {
        message: 'audit log filter values are not supported by this adapter',
      }),
    );

    const error = await createClient()
      .queryAuditLogFilterValues({ query: WINDOW, filter: 'actor.id' })
      .catch((e: Error) => e);

    // Separate from AuditLogsNotSupportedError: an adapter can serve records
    // and aggregate nothing, and the picker falls back to free-text entry
    // rather than the page declaring there is no trail.
    expect(error).toBeInstanceOf(AuditFilterValuesNotSupportedError);
    expect(error).not.toBeInstanceOf(AuditLogsNotSupportedError);
  });
});
