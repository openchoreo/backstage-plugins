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

// TanStack decides staleness from `Date.now()` (via `timeUntilStale`), so we
// simulate elapsed time by offsetting it rather than with jest fake timers —
// the shared client retries once on failure, and that backoff needs a real
// `setTimeout` to fire.
const realDateNow = Date.now.bind(Date);
let timeOffset = 0;
const advanceTime = (ms: number) => {
  timeOffset += ms;
};

describe('CachingCatalogApi', () => {
  beforeEach(() => {
    // The wrapper uses the shared singleton; isolate each test.
    queryClient.clear();
    timeOffset = 0;
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => realDateNow() + timeOffset);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  describe('freshness (the promise must never resolve with data we cannot correct)', () => {
    // These lock in the fix for the bug where creating a component left the
    // Project Contents table, the namespace Projects card and /catalog showing
    // the pre-create list. `ensureQueryData({ revalidateIfStale: true })` served
    // the stale value and discarded the revalidation; CatalogApi's consumers are
    // one-shot awaits with no way to receive it. Nothing here was covered before,
    // which is exactly why the bug shipped green.
    it('serves a cached read within the freshness window without hitting the delegate', async () => {
      const delegate = makeDelegate();
      const api = new CachingCatalogApi(delegate, userA);

      await api.getEntities({ filter: { kind: 'component' } });
      await api.getEntities({ filter: { kind: 'component' } });

      expect(delegate.getEntities).toHaveBeenCalledTimes(1);
    });

    it('AWAITS the refetch on a stale entry and resolves with the NEW value', async () => {
      const getEntities = jest
        .fn()
        .mockResolvedValueOnce({ items: [{ metadata: { name: 'old' } }] })
        .mockResolvedValueOnce({ items: [{ metadata: { name: 'new' } }] });
      const api = new CachingCatalogApi(makeDelegate({ getEntities }), userA);

      const first = await api.getEntities({ filter: { kind: 'component' } });
      expect(first.items[0].metadata.name).toBe('old');

      // Past the freshness window — as any create-then-navigate-back is.
      advanceTime(10_000);

      // The resolved VALUE is what matters: serving 'old' here while refetching
      // in the background is the bug, because nothing would ever deliver 'new'.
      const second = await api.getEntities({ filter: { kind: 'component' } });
      expect(second.items[0].metadata.name).toBe('new');
      expect(getEntities).toHaveBeenCalledTimes(2);
    });

    it('falls back to the last good value when a refetch over a warm entry fails', async () => {
      const getEntities = jest
        .fn()
        .mockResolvedValueOnce({ items: [{ metadata: { name: 'good' } }] });
      const api = new CachingCatalogApi(makeDelegate({ getEntities }), userA);

      await api.getEntities({ filter: { kind: 'component' } });

      // Persistent rejection so the client's single retry fails too.
      getEntities.mockRejectedValue(new Error('502 Bad Gateway'));
      advanceTime(10_000);

      // A transient blip must not blank a page that previously rode it out.
      const result = await api.getEntities({ filter: { kind: 'component' } });
      expect(result.items[0].metadata.name).toBe('good');
    });

    it('does NOT serve invalidated data when the refresh fails', async () => {
      // A write said this entry is wrong; if the follow-up read fails we must
      // surface the error rather than resurrect the value the write discarded
      // (for removeEntityByUid, that value is an entity the user just deleted).
      //
      // The flag has to be captured BEFORE the fetch: TanStack's `error` action
      // sets isInvalidated=true unconditionally, so a post-failure read of it
      // cannot tell "a write invalidated this" from "the refresh failed" — and
      // a guard written that way would never fall back at all.
      const getEntities = jest
        .fn()
        .mockResolvedValueOnce({ items: [{ metadata: { name: 'deleted' } }] });
      const api = new CachingCatalogApi(makeDelegate({ getEntities }), userA);

      await api.getEntities({ filter: { kind: 'component' } });

      await api.refreshEntity('component:default/svc');
      getEntities.mockRejectedValue(new Error('502 Bad Gateway'));

      await expect(
        api.getEntities({ filter: { kind: 'component' } }),
      ).rejects.toThrow('502 Bad Gateway');
    });

    it('does not retry a failed read (the caller is awaiting it)', async () => {
      // The app default is retry: 1. Because these reads are awaited, that
      // backoff lands directly in a page load — two round-trips before the
      // fallback. Exactly one delegate call per read.
      const getEntities = jest
        .fn()
        .mockResolvedValueOnce({ items: [{ metadata: { name: 'good' } }] });
      const api = new CachingCatalogApi(makeDelegate({ getEntities }), userA);

      await api.getEntities({ filter: { kind: 'component' } });
      expect(getEntities).toHaveBeenCalledTimes(1);

      getEntities.mockRejectedValue(new Error('502 Bad Gateway'));
      advanceTime(10_000);
      await api.getEntities({ filter: { kind: 'component' } });

      expect(getEntities).toHaveBeenCalledTimes(2);
    });

    it('rejects when the very first read fails (no last good value to serve)', async () => {
      const api = new CachingCatalogApi(
        makeDelegate({
          getEntities: jest.fn().mockRejectedValue(new Error('boom')),
        }),
        userA,
      );

      await expect(
        api.getEntities({ filter: { kind: 'component' } }),
      ).rejects.toThrow('boom');
    });

    it('awaits past a stale null sentinel so a since-created entity is returned', async () => {
      // The create-then-return case for getEntityByRef: the first read 404s and
      // caches `null`; the entity now exists and the second read must find it.
      const getEntityByRef = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ kind: 'Component' });
      const api = new CachingCatalogApi(
        makeDelegate({ getEntityByRef }),
        userA,
      );

      await expect(
        api.getEntityByRef('component:default/svc'),
      ).resolves.toBeUndefined();

      advanceTime(10_000);

      await expect(
        api.getEntityByRef('component:default/svc'),
      ).resolves.toEqual({ kind: 'Component' });
    });
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
