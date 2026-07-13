import {
  useInfiniteQuery,
  type QueryKey,
  type InfiniteData,
} from '@tanstack/react-query';
import { useUserScopedKey } from '../query/OpenChoreoQueryProvider';

/**
 * A single page returned by the fetcher. `items` are the rows for this page and
 * `total` (optional) is the overall server-side count, read off the first page.
 * `hasMore` (optional) overrides the default "page shorter than `pageSize` ends
 * pagination" heuristic — needed when a page is a fan-out/merge of several
 * requests, so its length isn't a clean end-of-list signal.
 * `nextCursor` (optional) lets a fan-out fetcher carry a composite cursor
 * forward (e.g. a per-component timestamp map); when present it's used verbatim
 * as the next page param instead of `getCursor(lastItem)`.
 */
export interface OpenChoreoPage<TItem> {
  items: TItem[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

/** Options for {@link useOpenChoreoInfiniteQuery}. */
export interface UseOpenChoreoInfiniteQueryOptions<TItem> {
  /** Registered-but-idle when false (a prerequisite isn't ready). @default true */
  enabled?: boolean;
  /** Poll interval in ms, or false to stop. Re-fetches all loaded pages. */
  refetchInterval?: number | false;
  /** Freshness window in ms. Overrides the app `QueryClient` default. */
  staleTime?: number;
  /**
   * Derive the cursor for the next page. Receives the last item of the last
   * page and the last page itself (so a fan-out fetcher can read a composite
   * `page.nextCursor`). Return `undefined`/`null` to signal no next page.
   * Called only when the previous page is not the last (per `hasMore`/length).
   */
  getCursor: (
    lastItem: TItem,
    page: OpenChoreoPage<TItem>,
  ) => string | undefined | null;
  /** Page size — a page shorter than this is treated as the last page. */
  pageSize: number;
}

/** What {@link useOpenChoreoInfiniteQuery} returns. */
export interface UseOpenChoreoInfiniteQueryResult<TItem> {
  /** All loaded rows, in page order. */
  items: TItem[];
  /** First load with no data yet. */
  loading: boolean;
  /** A next-page (loadMore) fetch is in flight. */
  loadingMore: boolean;
  /**
   * A background refresh of the existing pages is in flight while data is
   * already on screen — true only when it's neither the first load nor a
   * loadMore, so it maps to the "keep content, show a subtle indicator" state.
   */
  isRefetching: boolean;
  /** The last error, or null. */
  error: Error | null;
  /** Server-side total from the first page, or the loaded count as a fallback. */
  totalCount: number;
  /** Whether another page can be loaded. */
  hasMore: boolean;
  /** Load the next page (no-op when there is none / already loading). */
  loadMore: () => void;
  /** Re-fetch from page 1. Resolves when the refetch settles. */
  refresh: () => Promise<void>;
}

/**
 * Cursor-paginated counterpart to `useOpenChoreoQuery`, for the "load more +
 * live poll" log/event lists. Wraps TanStack's `useInfiniteQuery` and keeps the
 * `{ items, hasMore, loadMore, refresh }` shape the hand-rolled log hooks expose,
 * so their consumers don't change. The fetcher receives an opaque `cursor`
 * (undefined on the first page) built from the previous page's last item via
 * `getCursor`; a page shorter than `pageSize` ends pagination.
 *
 * @param queryKey Stable key for this list (scope + filters). Drives caching.
 * @param fetcher Fetches one page given the cursor for that page.
 * @param options Pagination + polling behaviour.
 */
export function useOpenChoreoInfiniteQuery<TItem>(
  queryKey: QueryKey,
  fetcher: (cursor: string | undefined) => Promise<OpenChoreoPage<TItem>>,
  options: UseOpenChoreoInfiniteQueryOptions<TItem>,
): UseOpenChoreoInfiniteQueryResult<TItem> {
  const { enabled, refetchInterval, staleTime, getCursor, pageSize } = options;

  // Namespace by the signed-in user (see useUserScopedKey) for cross-user
  // isolation, consistent with useOpenChoreoQuery.
  const scopeKey = useUserScopedKey();

  const {
    data,
    error,
    isPending,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    OpenChoreoPage<TItem>,
    Error,
    InfiniteData<OpenChoreoPage<TItem>>,
    QueryKey,
    string | undefined
  >({
    queryKey: scopeKey(queryKey),
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    getNextPageParam: lastPage => {
      // Explicit `hasMore` wins (fan-out pages); otherwise a short page ends it.
      const more = lastPage.hasMore ?? lastPage.items.length >= pageSize;
      if (!more) return undefined;
      // A fan-out page can carry its own composite `nextCursor` even if this
      // page happened to be empty for some components; only fall back to the
      // last-item cursor when there's an item and no explicit nextCursor.
      if (lastPage.nextCursor !== undefined) return lastPage.nextCursor;
      if (lastPage.items.length === 0) return undefined;
      const lastItem = lastPage.items[lastPage.items.length - 1];
      return getCursor(lastItem, lastPage) ?? undefined;
    },
    // Forward each option only when set — an explicit `undefined` overrides the
    // QueryClient default rather than inheriting it (so `staleTime: undefined`
    // resolves to 0 and defeats the 30s cache; see useOpenChoreoQuery).
    ...(enabled !== undefined ? { enabled } : {}),
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
    ...(staleTime !== undefined ? { staleTime } : {}),
  });

  const isDisabled = enabled === false;
  // A disabled query keeps its last data in the TanStack cache, but a disabled
  // list should render as empty — otherwise stale rows from the prior (enabled)
  // filter stay on screen when the gate closes (e.g. all log levels deselected,
  // where the "all" and "none" states share a query key). Surface nothing.
  const pages = isDisabled ? [] : data?.pages ?? [];
  const items = pages.flatMap(p => p.items);

  return {
    items,
    loading: isPending && !isDisabled,
    loadingMore: isFetchingNextPage,
    // Background refresh of page 1+: fetching, but not the first load and not a
    // loadMore. `!isDisabled` keeps a gated-off list from flashing the indicator.
    isRefetching:
      isFetching && !isPending && !isFetchingNextPage && !isDisabled,
    error: error ?? null,
    totalCount: pages[0]?.total ?? items.length,
    hasMore: isDisabled ? false : hasNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    refresh: () => refetch().then(() => undefined),
  };
}
