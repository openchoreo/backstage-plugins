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
  // resolveForNamespace resolves every environment in parallel, so these mocks
  // route by request path rather than by call order.
  function routingGet(envToObserver: Record<string, string>): jest.Mock {
    return jest.fn((path: string, opts: any) => {
      const p = opts?.params?.path ?? {};
      if (path === '/api/v1/namespaces/{namespaceName}/environments') {
        return Promise.resolve(
          ok({
            items: Object.keys(envToObserver).map(name => ({
              metadata: { name },
            })),
          }),
        );
      }
      if (
        path === '/api/v1/namespaces/{namespaceName}/environments/{envName}'
      ) {
        return Promise.resolve(
          ok({
            spec: {
              dataPlaneRef: { kind: 'DataPlane', name: `dp-${p.envName}` },
            },
          }),
        );
      }
      if (path === '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}') {
        return Promise.resolve(
          ok({
            spec: {
              observabilityPlaneRef: {
                kind: 'ObservabilityPlane',
                name: `obs-${p.dpName}`,
              },
            },
          }),
        );
      }
      if (
        path ===
        '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}'
      ) {
        // obs-dp-<envName> -> that environment's observer
        const envName = String(p.observabilityPlaneName).replace(
          /^obs-dp-/,
          '',
        );
        return Promise.resolve(
          ok({ spec: { observerURL: envToObserver[envName] } }),
        );
      }
      throw new Error(`unexpected path ${path}`);
    });
  }

  it('fails rather than report one plane as the whole namespace', async () => {
    // dev and prod sit on different observability planes, so no single URL can
    // answer for the namespace. Returning either one would present that plane's
    // deployments as the namespace's DORA numbers.
    mockedCreateClient.mockReturnValue({
      GET: routingGet({
        dev: 'https://observer-dev.example.com',
        prod: 'https://observer-prod.example.com',
      }),
    } as any);

    const resolver = new ObservabilityUrlResolver({
      baseUrl: 'https://api.example.com',
    });

    await expect(resolver.resolveForNamespace('org-1')).rejects.toThrow(
      /spans 2 observability planes/,
    );
    // The message must name the environments so the operator can act on it.
    await expect(resolver.resolveForNamespace('org-1')).rejects.toThrow(
      /dev -> https:\/\/observer-dev\.example\.com/,
    );
  });

  it('resolves when every environment agrees on one plane', async () => {
    mockedCreateClient.mockReturnValue({
      GET: routingGet({
        dev: 'https://observer.example.com',
        prod: 'https://observer.example.com',
      }),
    } as any);

    const resolver = new ObservabilityUrlResolver({
      baseUrl: 'https://api.example.com',
    });

    const result = await resolver.resolveForNamespace('org-1');
    expect(result.observerUrl).toBe('https://observer.example.com');
  });
});
