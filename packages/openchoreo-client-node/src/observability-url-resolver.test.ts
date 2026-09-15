import { ObservabilityUrlResolver } from './observability-url-resolver';

const get = jest.fn();

jest.mock('./factory', () => ({
  createOpenChoreoApiClient: () => ({ GET: get }),
}));

const advertised = (auditLogs: unknown) => ({
  data: { features: { auditLogs } },
  error: undefined,
  response: { ok: true, status: 200, statusText: 'OK' },
});

const failed = (status: number, statusText: string) => ({
  data: undefined,
  error: { message: statusText },
  response: { ok: false, status, statusText },
});

describe('ObservabilityUrlResolver.resolveForPlatform', () => {
  let resolver: ObservabilityUrlResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new ObservabilityUrlResolver({ baseUrl: 'http://api' });
  });

  it('uses the audit observer the API advertises', async () => {
    get.mockResolvedValueOnce(
      advertised({ enabled: true, observerURL: 'http://audit-observer:11080' }),
    );

    await expect(resolver.resolveForPlatform()).resolves.toEqual({
      observerUrl: 'http://audit-observer:11080',
    });
    expect(get).toHaveBeenCalledWith('/api/v1alpha1/metadata');
  });

  it('caches an advertised observer rather than asking per query', async () => {
    get.mockResolvedValueOnce(
      advertised({ enabled: true, observerURL: 'http://audit-observer:11080' }),
    );

    await resolver.resolveForPlatform();
    await resolver.resolveForPlatform();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reports audit logs disabled, without caching it', async () => {
    get.mockResolvedValue(advertised({ enabled: false }));

    await expect(resolver.resolveForPlatform()).resolves.toEqual({
      auditLogsEnabled: false,
    });
    await resolver.resolveForPlatform();

    // Asked again, so a trail enabled later is picked up.
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('fails on an enabled trail with no observer, rather than calling it disabled', async () => {
    get.mockResolvedValueOnce(advertised({ enabled: true }));

    await expect(resolver.resolveForPlatform()).rejects.toThrow(
      'Platform metadata reports audit logs enabled without an observer URL',
    );
  });

  it('fails when the control plane has no metadata endpoint', async () => {
    get.mockResolvedValueOnce(failed(404, 'Not Found'));

    await expect(resolver.resolveForPlatform()).rejects.toThrow(
      'Failed to get platform metadata: 404 Not Found',
    );
  });

  it('fails when the metadata endpoint errors', async () => {
    get.mockResolvedValueOnce(failed(500, 'Internal Server Error'));

    await expect(resolver.resolveForPlatform()).rejects.toThrow(
      'Failed to get platform metadata: 500 Internal Server Error',
    );
  });
});
