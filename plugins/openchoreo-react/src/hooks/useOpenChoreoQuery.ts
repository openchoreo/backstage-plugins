import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useUserScopedKey } from '../query/OpenChoreoQueryProvider';

/**
 * The `refetchInterval` accepted by a `useQuery<T, Error>`. Kept as a named
 * alias so the public option type below stays parameterised on `T` and matches
 * the internal `useQuery` call (an unparameterised `UseQueryOptions` collapses
 * to `unknown` and no longer type-checks against `useQuery<T, Error>`).
 */
type RefetchInterval<T> = UseQueryOptions<
  T,
  Error,
  T,
  QueryKey
>['refetchInterval'];

/**
 * Options accepted by {@link useOpenChoreoQuery}. A trimmed passthrough of the
 * TanStack Query options we actually want callers to set — everything else
 * (caching, dedup, retry) comes from the app-level `QueryClient` defaults so
 * behaviour stays consistent across the portal.
 */
export interface UseOpenChoreoQueryOptions<T> {
  /**
   * Freshness window for this query, in ms. Status-y data (deploy/binding
   * status, logs) should pass a short value; near-static data (roles, schemas)
   * can rely on the longer app default. Overrides the `QueryClient` default.
   */
  staleTime?: number;
  /**
   * Poll interval, in ms, or a function returning `false` to stop polling once
   * a run reaches a terminal state. Replaces hand-rolled `setInterval` loops.
   */
  refetchInterval?: RefetchInterval<T>;
  /**
   * When false, the query is registered but does not fetch — for data that is
   * gated on a prerequisite (e.g. an entity ref that isn't resolved yet).
   * @default true
   */
  enabled?: boolean;
  /**
   * Retry policy for a failed fetch. Overrides the app-level default (retry: 1).
   * Set `false`/`0` for fetchers that own their own retry/backoff, so the global
   * retry doesn't double it.
   */
  retry?: boolean | number;
}

/**
 * The shape every OpenChoreo data hook returns. Deliberately matches what
 * `ContentLoader` consumes — `loading` drives the first-load skeleton,
 * `isRefetching` drives the keep-content-on-screen overlay — so a hook built on
 * this wrapper plugs straight into `<ContentLoader loading isRefetching data error />`.
 */
export interface UseOpenChoreoQueryResult<T> {
  /** The cached/fetched data, or `undefined` before the first successful load. */
  data: T | undefined;
  /** First load with no data yet. Maps to TanStack's `isPending`. */
  loading: boolean;
  /**
   * Background refresh while data is already on screen. True only when a fetch
   * is in flight AND we already have data — so it never fires on the first load.
   */
  isRefetching: boolean;
  /** The last error, kept in `error` (never cached as data), or `null`. */
  error: Error | null;
  /**
   * Re-run the query. Resolves when the refetch settles, so callers that surface
   * a "refreshing" state (e.g. a mutation wrapping this) stay pending for the
   * real duration. Still drops into `onRetry`/void `refetch` props — the promise
   * is simply ignored there.
   */
  refetch: () => Promise<void>;
}

/**
 * The single response-caching entry point for OpenChoreo frontend hooks.
 *
 * A thin wrapper over TanStack Query's `useQuery` that (a) keeps the third-party
 * dependency out of ~90 call sites behind one swappable seam, and (b) maps the
 * result onto the `{ loading, isRefetching, data, error, refetch }` shape that
 * `ContentLoader` (from this package) expects. Caching, request dedup and retry
 * come from the app-level `QueryClient`; callers only supply a key + fetcher.
 *
 * The fetcher's thrown errors (including a Backstage `ResponseError` for a 403)
 * land in `error` — they are never cached as successful `data` — so existing
 * `isForbiddenError(error)` checks keep working.
 *
 * @example
 * ```ts
 * const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
 *   ['environments', stringifyEntityRef(entity)],
 *   () => client.fetchEnvironmentInfo(entity),
 * );
 * ```
 *
 * @param queryKey - Stable, serialisable key identifying this data (per client
 *   method + params). Drives caching and invalidation.
 * @param fetcher - Async function that performs the request via the API client.
 *   Receives an optional `{ signal }` (TanStack's AbortSignal) so long-running
 *   fetchers — e.g. an in-fetcher retry/backoff loop — can bail when the query
 *   is cancelled (unmount, supersede). Existing zero-arg fetchers ignore it.
 * @param options - Optional per-query overrides (freshness, polling, enablement).
 */
export function useOpenChoreoQuery<T>(
  queryKey: QueryKey,
  fetcher: (context: { signal: AbortSignal }) => Promise<T>,
  options: UseOpenChoreoQueryOptions<T> = {},
): UseOpenChoreoQueryResult<T> {
  // Namespace the key by the signed-in user so one user's cached responses are
  // never served to another (structural cross-user isolation — no clearing).
  const scopeKey = useUserScopedKey();
  const { data, error, isPending, isFetching, refetch } = useQuery<T, Error>({
    queryKey: scopeKey(queryKey),
    queryFn: ({ signal }) => fetcher({ signal }),
    // Only forward each option when the caller actually set it. Passing an
    // explicit `undefined` does NOT inherit the QueryClient default — TanStack
    // treats it as an override, so `staleTime: undefined` resolves to 0 (query
    // is stale immediately, `refetchOnMount` refires on every remount and the
    // 30s cache is silently defeated), and `retry: undefined` resets to the
    // built-in retry 3. Spread each key in only when defined so the app-level
    // defaults actually take effect.
    ...(options.staleTime !== undefined
      ? { staleTime: options.staleTime }
      : {}),
    ...(options.refetchInterval !== undefined
      ? { refetchInterval: options.refetchInterval }
      : {}),
    ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options.retry !== undefined ? { retry: options.retry } : {}),
  });

  // `enabled: false` leaves a query in a "pending but not fetching" state
  // forever; treat that as not-loading so a disabled query doesn't wedge a
  // consumer on the skeleton.
  const isDisabled = options.enabled === false;

  return {
    data,
    loading: isPending && !isDisabled,
    // Background refresh: a fetch is in flight while we already have data.
    // `!isPending` guarantees this is never true during the first load.
    isRefetching: isFetching && !isPending,
    error: error ?? null,
    // Map TanStack's rich refetch result to a bare `Promise<void>` so the seam
    // doesn't leak its types, while still resolving only once the refetch is done.
    refetch: () => refetch().then(() => undefined),
  };
}
