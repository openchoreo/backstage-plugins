import type {
  CatalogApi,
  GetEntitiesRequest,
  GetEntitiesResponse,
  GetEntitiesByRefsRequest,
  GetEntitiesByRefsResponse,
  QueryEntitiesRequest,
  QueryEntitiesResponse,
  GetEntityAncestorsRequest,
  GetEntityAncestorsResponse,
  GetEntityFacetsRequest,
  GetEntityFacetsResponse,
  GetLocationsResponse,
  QueryLocationsRequest,
  QueryLocationsResponse,
  QueryLocationsInitialRequest,
  StreamEntitiesRequest,
  AddLocationRequest,
  AddLocationResponse,
  ValidateEntityResponse,
  CatalogRequestOptions,
  Location,
} from '@backstage/catalog-client';
import type {
  AnalyzeLocationRequest,
  AnalyzeLocationResponse,
} from '@backstage/plugin-catalog-common';
import type { CompoundEntityRef, Entity } from '@backstage/catalog-model';
import type { QueryKey } from '@tanstack/react-query';
import { queryClient } from './queryClient';

/**
 * Resolves the signed-in user's `entityRef`, used to namespace the catalog
 * cache keys. Returns `undefined` until identity resolves (the caller then
 * keys under the pending sentinel).
 */
export type GetUserRef = () => Promise<string | undefined>;

/** Matches {@link OpenChoreoQueryProvider}'s sentinel for the pre-identity window. */
const PENDING_USER = '@openchoreo/pending-user';

/**
 * Freshness window for cached catalog reads.
 *
 * Deliberately short. `CatalogApi` is a PROMISE API with no subscribers, so a
 * stale entry must be AWAITED — we can never notify the caller about a
 * revalidation that lands after the promise resolved. This window therefore
 * exists only to collapse the sequential repeat-calls of a single
 * render/navigation burst (unmount/remount, tab switch, StrictMode's double
 * mount in dev). Concurrent callers already dedupe on the in-flight promise,
 * independent of `staleTime`.
 *
 * Any value long enough for a human to perceive would reintroduce the bug this
 * constant exists to prevent: create a component, navigate back, and see the
 * pre-create list with no way to be told otherwise.
 */
const CATALOG_STALE_TIME_MS = 5_000;

/**
 * No retry on catalog reads.
 *
 * These reads are AWAITED by the caller (see `cachedRead`), so the app-level
 * `retry: 1` would put its ~1s backoff directly into a page load: a failing
 * backend would make every navigation wait for two round-trips before falling
 * back to cached data. The retry bought little anyway — the fallback below
 * already rides out a transient blip, and the 5s window means the next
 * navigation re-attempts almost immediately.
 */
const CATALOG_RETRY = 0;

/**
 * A {@link CatalogApi} that routes catalog READS through the shared OpenChoreo
 * `queryClient`, so the repeat reads of a single navigation collapse to one
 * request instead of re-fetching from scratch.
 *
 * Backstage's own catalog hooks (`useEntityList` → `getEntities`/`queryEntities`,
 * the entity page → `getEntityByRef`) call this API directly, so wrapping it is
 * the only way to bring the catalog under the same cache as the OpenChoreo BFF
 * hooks. All other methods delegate straight through to the real client.
 *
 * IMPORTANT — this layer does NOT do stale-while-revalidate, and must not. SWR
 * requires a subscriber to receive the revalidation, and every consumer of this
 * API is a one-shot `await` (`useEffect`, `useAsync`, `EntityListProvider`),
 * never a TanStack observer. A promise resolves exactly once, so anything served
 * stale here can never be corrected on screen. Instant-paint belongs one layer
 * up, in React, where a component can re-render: our own surfaces get it from
 * `useOpenChoreoQuery`, and Backstage-owned surfaces from a cache seed (see
 * `pickCatalogSeed` in the app's catalog list).
 *
 * Keys mirror the hook convention exactly (`['@user', userEntityRef, ...]`, see
 * `useUserScopedKey`) so per-user isolation is structural: a different user
 * occupies a disjoint key space and can never read the previous user's
 * permission-scoped catalog results. The auth token is deliberately NOT part of
 * the key — the `userEntityRef` already isolates users, and the token rotates,
 * which would otherwise bust the cache on every refresh.
 *
 * Writes that change catalog state (`refreshEntity`, `removeEntityByUid`,
 * location add/remove/update) invalidate the whole `['@user', ref, 'catalog']`
 * subtree so the next read re-fetches. The two `AsyncIterable` streamers and the
 * rarely-hot reads (facets, locations, ancestors) pass through uncached.
 */
export class CachingCatalogApi implements CatalogApi {
  constructor(
    private readonly delegate: CatalogApi,
    private readonly getUserRef: GetUserRef,
  ) {}

  /**
   * Build the per-user cache key for a catalog method call. `['@user', ref,
   * 'catalog', method, ...args]` — the same shape (and literal `'@user'` prefix)
   * the query hooks use, so the two never collide or cross-serve.
   */
  private async keyFor(method: string, args: unknown[]): Promise<QueryKey> {
    const user = (await this.getUserRef()) ?? PENDING_USER;
    return ['@user', user, 'catalog', method, ...args];
  }

  /**
   * Read-through cache with an honest promise: a fresh entry (within
   * {@link CATALOG_STALE_TIME_MS}) resolves instantly with no network, a stale
   * one AWAITS the refetch and resolves with the new data.
   *
   * Uses `fetchQuery` rather than `ensureQueryData({ revalidateIfStale: true })`.
   * `ensureQueryData` resolves with the STALE value and kicks a background
   * refetch whose result it discards (`void this.prefetchQuery(...)`) — correct
   * only when a TanStack observer is watching the cache and will re-render. No
   * consumer of `CatalogApi` is one, so that fresh data was never reaching the
   * screen. See the class doc.
   *
   * Concurrent callers still dedupe: `fetchQuery` returns the in-flight promise
   * when one exists, regardless of `staleTime`.
   */
  private async cachedRead<T>(
    method: string,
    args: unknown[],
    fetch: () => Promise<T>,
  ): Promise<T> {
    return this.readThrough(await this.keyFor(method, args), fetch);
  }

  /**
   * The single read path: fetch honestly, and on failure fall back to the last
   * good value only when that value is still trustworthy.
   *
   * `ensureQueryData` used to swallow a failed revalidation and keep serving the
   * cached value; `fetchQuery` rejects, which would blank a page that today
   * rides out a transient 502. The fallback restores that resilience — but NOT
   * for an entry a write already invalidated, whose cached value is known-wrong
   * (e.g. an entity `removeEntityByUid` just deleted).
   *
   * The invalidation flag must be read BEFORE the fetch: TanStack's `error`
   * action sets `isInvalidated: true` unconditionally ("flag existing data as
   * invalidated if we get a background error"), so after a failure the flag can
   * no longer distinguish "a write invalidated this" from "the refresh failed".
   */
  private async readThrough<T>(
    queryKey: QueryKey,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    const wasInvalidated =
      queryClient.getQueryState<T>(queryKey)?.isInvalidated === true;
    try {
      return await queryClient.fetchQuery({
        queryKey,
        queryFn,
        staleTime: CATALOG_STALE_TIME_MS,
        retry: CATALOG_RETRY,
      });
    } catch (err) {
      if (wasInvalidated) {
        throw err;
      }
      const lastGood = queryClient.getQueryData<T>(queryKey);
      if (lastGood !== undefined) {
        return lastGood;
      }
      throw err;
    }
  }

  /**
   * Read-through cache for a method that may resolve to `undefined` (e.g.
   * `getEntityByRef` on a missing/404 entity). TanStack's `fetchQuery`
   * REJECTS when the queryFn resolves to `undefined`
   * ("Query data cannot be undefined"), which would turn a normal not-found into
   * a thrown error and break callers (the entity page and header breadcrumb
   * tolerate `undefined`). Cache a `null` sentinel instead (which TanStack does
   * accept) and map it back to `undefined` so the `CatalogApi` contract holds.
   */
  private async cachedReadNullable<T>(
    method: string,
    args: unknown[],
    fetch: () => Promise<T | undefined>,
  ): Promise<T | undefined> {
    // Shares `readThrough`, so the freshness window, retry policy and
    // invalidation-aware fallback can never drift from the non-nullable path.
    // `undefined` never reaches the cache (the sentinel is `null`), so a cold
    // miss still surfaces the error there.
    const value = await this.readThrough<T | null>(
      await this.keyFor(method, args),
      async () => (await fetch()) ?? null,
    );
    return value ?? undefined;
  }

  /** Drop every cached catalog read for the current user after a write. */
  private async invalidateCatalog(): Promise<void> {
    const user = (await this.getUserRef()) ?? PENDING_USER;
    await queryClient.invalidateQueries({
      queryKey: ['@user', user, 'catalog'],
    });
  }

  // ---- Cached reads -------------------------------------------------------

  getEntities(
    request?: GetEntitiesRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntitiesResponse> {
    return this.cachedRead('getEntities', [request], () =>
      this.delegate.getEntities(request, options),
    );
  }

  getEntitiesByRefs(
    request: GetEntitiesByRefsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntitiesByRefsResponse> {
    return this.cachedRead('getEntitiesByRefs', [request], () =>
      this.delegate.getEntitiesByRefs(request, options),
    );
  }

  queryEntities(
    request?: QueryEntitiesRequest,
    options?: CatalogRequestOptions,
  ): Promise<QueryEntitiesResponse> {
    return this.cachedRead('queryEntities', [request], () =>
      this.delegate.queryEntities(request, options),
    );
  }

  getEntityByRef(
    entityRef: string | CompoundEntityRef,
    options?: CatalogRequestOptions,
  ): Promise<Entity | undefined> {
    // Nullable: a missing entity resolves to `undefined`, which fetchQuery
    // cannot cache — see cachedReadNullable.
    return this.cachedReadNullable('getEntityByRef', [entityRef], () =>
      this.delegate.getEntityByRef(entityRef, options),
    );
  }

  // ---- Writes: delegate then invalidate the user's catalog cache ----------

  async removeEntityByUid(
    uid: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    await this.delegate.removeEntityByUid(uid, options);
    await this.invalidateCatalog();
  }

  async refreshEntity(
    entityRef: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    await this.delegate.refreshEntity(entityRef, options);
    await this.invalidateCatalog();
  }

  async addLocation(
    location: AddLocationRequest,
    options?: CatalogRequestOptions,
  ): Promise<AddLocationResponse> {
    const result = await this.delegate.addLocation(location, options);
    await this.invalidateCatalog();
    return result;
  }

  async removeLocationById(
    id: string,
    options?: CatalogRequestOptions,
  ): Promise<void> {
    await this.delegate.removeLocationById(id, options);
    await this.invalidateCatalog();
  }

  async updateLocation(
    id: string,
    location: { type?: string; target: string },
    options?: CatalogRequestOptions,
  ): Promise<Location> {
    const result = await this.delegate.updateLocation(id, location, options);
    await this.invalidateCatalog();
    return result;
  }

  // ---- Pass-through (uncached reads + streams + validate/analyze) ----------

  getEntityAncestors(
    request: GetEntityAncestorsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntityAncestorsResponse> {
    return this.delegate.getEntityAncestors(request, options);
  }

  getEntityFacets(
    request: GetEntityFacetsRequest,
    options?: CatalogRequestOptions,
  ): Promise<GetEntityFacetsResponse> {
    return this.delegate.getEntityFacets(request, options);
  }

  getLocations(
    request?: {},
    options?: CatalogRequestOptions,
  ): Promise<GetLocationsResponse> {
    return this.delegate.getLocations(request, options);
  }

  queryLocations(
    request?: QueryLocationsRequest,
    options?: CatalogRequestOptions,
  ): Promise<QueryLocationsResponse> {
    return this.delegate.queryLocations(request, options);
  }

  streamLocations(
    request?: QueryLocationsInitialRequest,
    options?: CatalogRequestOptions,
  ): AsyncIterable<Location[]> {
    return this.delegate.streamLocations(request, options);
  }

  getLocationById(
    id: string,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.delegate.getLocationById(id, options);
  }

  getLocationByRef(
    locationRef: string,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.delegate.getLocationByRef(locationRef, options);
  }

  getLocationByEntity(
    entityRef: string | CompoundEntityRef,
    options?: CatalogRequestOptions,
  ): Promise<Location | undefined> {
    return this.delegate.getLocationByEntity(entityRef, options);
  }

  validateEntity(
    entity: Entity,
    locationRef: string,
    options?: CatalogRequestOptions,
  ): Promise<ValidateEntityResponse> {
    return this.delegate.validateEntity(entity, locationRef, options);
  }

  analyzeLocation(
    location: AnalyzeLocationRequest,
    options?: CatalogRequestOptions,
  ): Promise<AnalyzeLocationResponse> {
    return this.delegate.analyzeLocation(location, options);
  }

  streamEntities(
    request?: StreamEntitiesRequest,
    options?: CatalogRequestOptions,
  ): AsyncIterable<Entity[]> {
    return this.delegate.streamEntities(request, options);
  }
}
