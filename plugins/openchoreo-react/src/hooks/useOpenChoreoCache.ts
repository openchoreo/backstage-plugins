import { useQueryClient, type QueryKey } from '@tanstack/react-query';

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
}

/**
 * Returns an {@link OpenChoreoCache} bound to the app's `QueryClient`. Use only
 * when `useOpenChoreoQuery`/`useOpenChoreoMutation` can't express the operation
 * (e.g. an optimistic toggle that must respond before the PATCH resolves).
 */
export function useOpenChoreoCache(): OpenChoreoCache {
  const queryClient = useQueryClient();
  return {
    setData: (queryKey, updater) =>
      queryClient.setQueryData(queryKey, updater),
    invalidate: queryKey => {
      void queryClient.invalidateQueries({ queryKey });
    },
    fetchQuery: (queryKey, fetcher, options) =>
      queryClient.fetchQuery({
        queryKey,
        queryFn: fetcher,
        staleTime: options?.staleTime,
      }),
    getData: queryKey => queryClient.getQueryData(queryKey),
  };
}
