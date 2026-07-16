import type { CatalogApi } from '@backstage/catalog-client';
import { queryClient } from './queryClient';
import { CachingCatalogApi } from './CachingCatalogApi';

/**
 * A minimal `CatalogApi` stub whose read methods are jest mocks, so we can
 * assert exactly how often the wrapper hits the delegate.
 */
function makeDelegate(overrides: Partial<CatalogApi> = {}): CatalogApi {
  const base = {
    getEntities: jest.fn().mockResolvedValue({ items: [] }),
    getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
    queryEntities: jest.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    getEntityByRef: jest.fn().mockResolvedValue({ kind: 'Component' }),
    refreshEntity: jest.fn().mockResolvedValue(undefined),
    removeEntityByUid: jest.fn().mockResolvedValue(undefined),
    addLocation: jest.fn().mockResolvedValue({}),
    removeLocationById: jest.fn().mockResolvedValue(undefined),
    updateLocation: jest.fn().mockResolvedValue({}),
    getEntityAncestors: jest.fn(),
    getEntityFacets: jest.fn(),
    getLocations: jest.fn(),
    queryLocations: jest.fn(),
    streamLocations: jest.fn(),
    getLocationById: jest.fn(),
    getLocationByRef: jest.fn(),
    getLocationByEntity: jest.fn(),
    validateEntity: jest.fn(),
    analyzeLocation: jest.fn(),
    streamEntities: jest.fn(),
  } as unknown as CatalogApi;
  return { ...base, ...overrides };
}

const userA = () => Promise.resolve('user:default/alice');
const userB = () => Promise.resolve('user:default/bob');

describe('CachingCatalogApi', () => {
  beforeEach(() => {
    // The wrapper uses the shared singleton; isolate each test.
    queryClient.clear();
  });

  it('dedupes concurrent identical reads to a single delegate call', async () => {
    const delegate = makeDelegate();
    const api = new CachingCatalogApi(delegate, userA);

    await Promise.all([
      api.getEntities({ filter: { kind: 'component' } }),
      api.getEntities({ filter: { kind: 'component' } }),
    ]);

    expect(delegate.getEntities).toHaveBeenCalledTimes(1);
  });

  it('caches the read so the value is available synchronously after resolve', async () => {
    const delegate = makeDelegate({
      getEntityByRef: jest.fn().mockResolvedValue({ kind: 'Component' }),
    });
    const api = new CachingCatalogApi(delegate, userA);

    await api.getEntityByRef('component:default/svc');

    // Warm cache entry under the per-user key: this is what lets a revisit
    // paint instantly before the background revalidation resolves.
    const cached = queryClient.getQueryData([
      '@user',
      'user:default/alice',
      'catalog',
      'getEntityByRef',
      'component:default/svc',
    ]);
    expect(cached).toEqual({ kind: 'Component' });
  });

  it('returns undefined (no throw) when getEntityByRef resolves to undefined', async () => {
    // Regression: getEntityByRef returns Promise<Entity | undefined>, and
    // TanStack's fetchQuery rejects on a resolved `undefined` ("Query data
    // cannot be undefined"). The wrapper must cache a null sentinel and hand
    // back undefined so a missing/404 entity stays a graceful not-found.
    const delegate = makeDelegate({
      getEntityByRef: jest.fn().mockResolvedValue(undefined),
    });
    const api = new CachingCatalogApi(delegate, userA);

    await expect(
      api.getEntityByRef('component:default/missing'),
    ).resolves.toBeUndefined();

    // A second call still resolves to undefined (the null sentinel is cached,
    // mapped back to undefined) — never a throw.
    await expect(
      api.getEntityByRef('component:default/missing'),
    ).resolves.toBeUndefined();

    // The cache holds the null sentinel, not undefined (which TanStack rejects).
    expect(
      queryClient.getQueryData([
        '@user',
        'user:default/alice',
        'catalog',
        'getEntityByRef',
        'component:default/missing',
      ]),
    ).toBeNull();
  });

  it('keys reads by the request, so different requests do not collide', async () => {
    const delegate = makeDelegate();
    const api = new CachingCatalogApi(delegate, userA);

    await api.getEntities({ filter: { kind: 'component' } });
    await api.getEntities({ filter: { kind: 'api' } });

    // Two distinct requests → two distinct cache entries → two delegate calls.
    expect(delegate.getEntities).toHaveBeenCalledTimes(2);
  });

  it('isolates the cache per user (no cross-serve between users)', async () => {
    const delegate = makeDelegate();
    const apiA = new CachingCatalogApi(delegate, userA);
    const apiB = new CachingCatalogApi(delegate, userB);

    await apiA.getEntities({ filter: { kind: 'component' } });
    await apiB.getEntities({ filter: { kind: 'component' } });

    // Same request, different users → disjoint key spaces → the delegate is
    // hit once per user; neither reads the other's entry.
    expect(delegate.getEntities).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData([
        '@user',
        'user:default/alice',
        'catalog',
        'getEntities',
        { filter: { kind: 'component' } },
      ]),
    ).toBeDefined();
    expect(
      queryClient.getQueryData([
        '@user',
        'user:default/bob',
        'catalog',
        'getEntities',
        { filter: { kind: 'component' } },
      ]),
    ).toBeDefined();
  });

  it('invalidates the user catalog cache after refreshEntity', async () => {
    const delegate = makeDelegate();
    const api = new CachingCatalogApi(delegate, userA);

    await api.getEntities({ filter: { kind: 'component' } });
    expect(delegate.getEntities).toHaveBeenCalledTimes(1);

    await api.refreshEntity('component:default/svc');

    // The catalog subtree was invalidated → the next read re-hits the delegate
    // rather than serving the now-stale cached list.
    await api.getEntities({ filter: { kind: 'component' } });
    expect(delegate.refreshEntity).toHaveBeenCalledWith(
      'component:default/svc',
      undefined,
    );
    expect(delegate.getEntities).toHaveBeenCalledTimes(2);
  });

  it('passes streamEntities through unchanged (not promise-wrapped)', () => {
    async function* stream(): AsyncIterable<never[]> {
      yield [];
    }
    const iterable = stream();
    const delegate = makeDelegate({
      streamEntities: jest.fn().mockReturnValue(iterable),
    });
    const api = new CachingCatalogApi(delegate, userA);

    // Must return the delegate's AsyncIterable verbatim — wrapping it in a
    // promise (via fetchQuery) would break `for await` consumers.
    expect(api.streamEntities()).toBe(iterable);
    expect(typeof (api.streamEntities() as any)[Symbol.asyncIterator]).toBe(
      'function',
    );
  });

  it('delegates a pass-through read (getLocations) without caching', async () => {
    const delegate = makeDelegate({
      getLocations: jest.fn().mockResolvedValue({ items: [] }),
    });
    const api = new CachingCatalogApi(delegate, userA);

    await api.getLocations();
    await api.getLocations();

    // No fetchQuery wrapping → every call reaches the delegate.
    expect(delegate.getLocations).toHaveBeenCalledTimes(2);
  });
});
