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
 * A {@link CatalogApi} that routes catalog READS through the shared OpenChoreo
 * `queryClient`, so a revisited catalog list or entity page paints instantly
 * from cache (and revalidates in the background per the client's `staleTime: 0`
 * policy) instead of re-fetching from scratch and flashing a skeleton.
 *
 * Backstage's own catalog hooks (`useEntityList` → `getEntities`/`queryEntities`,
 * the entity page → `getEntityByRef`) call this API directly, so wrapping it is
 * the only way to bring the catalog under the same cache as the OpenChoreo BFF
 * hooks. All other methods delegate straight through to the real client.
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
   * Read-through cache: serve the warm entry immediately and revalidate in the
   * background. Uses `ensureQueryData({ revalidateIfStale: true })` rather than
   * `fetchQuery`: with the client default `staleTime: 0` every entry is stale,
   * and `fetchQuery` would AWAIT the network on a stale entry (never painting
   * cached-first). `ensureQueryData` returns the cached value synchronously when
   * present and kicks a background refetch, which is the actual instant-paint +
   * stale-while-revalidate behavior an already-warm revisit wants. Concurrent
   * callers still dedupe on the shared key.
   */
  private async cachedRead<T>(
    method: string,
    args: unknown[],
    fetch: () => Promise<T>,
  ): Promise<T> {
    return queryClient.ensureQueryData({
      queryKey: await this.keyFor(method, args),
      queryFn: fetch,
      revalidateIfStale: true,
    });
  }

  /**
   * Read-through cache for a method that may resolve to `undefined` (e.g.
   * `getEntityByRef` on a missing/404 entity). TanStack's `ensureQueryData`
   * (like `fetchQuery`) REJECTS when the queryFn resolves to `undefined`
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
    const value = await queryClient.ensureQueryData<T | null>({
      queryKey: await this.keyFor(method, args),
      queryFn: async () => (await fetch()) ?? null,
      revalidateIfStale: true,
    });
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
