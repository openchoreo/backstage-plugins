import { ObservabilityUrlResolver } from './observability-url-resolver';
import { createOpenChoreoApiClient } from './factory';

jest.mock('./factory', () => ({
  createOpenChoreoApiClient: jest.fn(),
}));

const mockedCreateClient = createOpenChoreoApiClient as jest.MockedFunction<
  typeof createOpenChoreoApiClient
>;

function ok(data: unknown) {
  return { data, error: undefined, response: { ok: true, status: 200 } };
}

describe('ObservabilityUrlResolver.resolveForNamespace', () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
  });

  it('resolves through the namespace environments and caches the result', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce(ok({ items: [{ metadata: { name: 'dev' } }] }))
      .mockResolvedValueOnce(ok({ spec: { dataPlaneRef: undefined } }))
      .mockResolvedValueOnce(ok({ spec: { observabilityPlaneRef: undefined } }))
      .mockResolvedValueOnce(
        ok({ spec: { observerURL: 'https://observer.example.com' } }),
      );
    mockedCreateClient.mockReturnValue({ GET: get } as any);

    const resolver = new ObservabilityUrlResolver({
      baseUrl: 'https://api.example.com',
    });

    const first = await resolver.resolveForNamespace('org-1', 'user-a-token');
    expect(first.observerUrl).toBe('https://observer.example.com');
    expect(get).toHaveBeenCalledTimes(4);

    // Second call for the *same* token should hit the cache: no new HTTP calls.
    const second = await resolver.resolveForNamespace('org-1', 'user-a-token');
    expect(second).toEqual(first);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it('does not leak a cached result across callers with different tokens', async () => {
    // resolveForNamespace creates its own client for listing environments,
    // then resolveForEnvironment creates another one internally — route each
    // by token rather than assuming a fixed call count/order.
    const getA = jest
      .fn()
      .mockResolvedValueOnce(ok({ items: [{ metadata: { name: 'dev' } }] }))
      .mockResolvedValueOnce(ok({ spec: { dataPlaneRef: undefined } }))
      .mockResolvedValueOnce(ok({ spec: { observabilityPlaneRef: undefined } }))
      .mockResolvedValueOnce(
        ok({ spec: { observerURL: 'https://observer.example.com' } }),
      );

    // User B has no visible environments in the same namespace (e.g. RBAC
    // scopes them out) and must not receive user A's cached URL.
    const getB = jest.fn().mockResolvedValue(ok({ items: [] }));

    mockedCreateClient.mockImplementation(
      config => ({ GET: config.token === 'user-a-token' ? getA : getB } as any),
    );

    const resolver = new ObservabilityUrlResolver({
      baseUrl: 'https://api.example.com',
    });

    const forUserA = await resolver.resolveForNamespace(
      'org-1',
      'user-a-token',
    );
    expect(forUserA.observerUrl).toBe('https://observer.example.com');

    await expect(
      resolver.resolveForNamespace('org-1', 'user-b-token'),
    ).rejects.toThrow(/No environments found in namespace 'org-1'/);

    // User B's request must have gone through its own client, not reused
    // user A's cached result.
    expect(getB).toHaveBeenCalledTimes(1);
  });
});
