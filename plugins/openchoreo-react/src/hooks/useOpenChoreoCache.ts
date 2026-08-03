import { useMemo } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useUserScopedKey } from '../query/OpenChoreoQueryProvider';

/**
 * Imperative cache handle for the rare hooks that need to touch a cached query
 * outside the normal `useOpenChoreoQuery`/`useOpenChoreoMutation` flow — chiefly
 * optimistic writes (flip the cached value before the server confirms) and
 * targeted invalidation. Keeps `@tanstack/react-query` behind this package's
 * single seam so consuming plugins never import it directly.
 */
export interface OpenChoreoCache {
  /**
   * Optimistically write into a cached query. `updater` receives the current
   * cached value (or `undefined` if nothing is cached yet) and returns the next
   * value. Mirrors TanStack's `setQueryData` updater form.
   */
  setData: <T>(queryKey: QueryKey, updater: (prev: T | undefined) => T) => void;
  /** Mark every query whose key starts with `queryKey` stale and refetch it. */
  invalidate: (queryKey: QueryKey) => void;
  /**
   * Imperatively fetch-and-cache a query, returning its data. Deduplicates
   * concurrent callers and serves the cached value within `staleTime`. For the
   * lazy, dynamically-keyed hooks (fetch-on-demand keyed by a runtime id) that
   * `useOpenChoreoQuery`'s render-time key can't express.
   */
  fetchQuery: <T>(
    queryKey: QueryKey,
    fetcher: () => Promise<T>,
    options?: { staleTime?: number },
  ) => Promise<T>;
  /** Synchronously read a cached query's data, or `undefined` if not cached. */
  getData: <T>(queryKey: QueryKey) => T | undefined;
  /**
   * Remove a cached query entirely. Unlike `setData(key, () => undefined)` —
   * which TanStack treats as a no-op and does NOT clear — this actually drops
   * the entry so the next read misses and a fresh fetch runs.
   */
  remove: (queryKey: QueryKey) => void;
}

/**
 * Returns an {@link OpenChoreoCache} bound to the app's `QueryClient`. Use only
 * when `useOpenChoreoQuery`/`useOpenChoreoMutation` can't express the operation
 * (e.g. an optimistic toggle that must respond before the PATCH resolves).
 */
export function useOpenChoreoCache(): OpenChoreoCache {
  const queryClient = useQueryClient();
  // Namespace every key by the signed-in user, identically to the query hooks,
  // so imperative reads/writes/invalidations hit the same entries the queries
  // stored (see useUserScopedKey). `scopeKey` is stable for the user's scope.
  const scopeKey = useUserScopedKey();
  // `useQueryClient()` returns a stable client for the provider's lifetime, so
  // memoise the handle: without this, a fresh object + 5 closures every render
  // would break any consumer that lists `cache` in a useCallback/useEffect dep.
  return useMemo<OpenChoreoCache>(
    () => ({
      setData: (queryKey, updater) =>
        queryClient.setQueryData(scopeKey(queryKey), updater),
      invalidate: queryKey => {
        void queryClient.invalidateQueries({ queryKey: scopeKey(queryKey) });
      },
      fetchQuery: (queryKey, fetcher, options) =>
        queryClient.fetchQuery({
          queryKey: scopeKey(queryKey),
          queryFn: fetcher,
          staleTime: options?.staleTime,
        }),
      getData: queryKey => queryClient.getQueryData(scopeKey(queryKey)),
      remove: queryKey =>
        queryClient.removeQueries({
          queryKey: scopeKey(queryKey),
          exact: true,
        }),
    }),
    [queryClient, scopeKey],
  );
}
