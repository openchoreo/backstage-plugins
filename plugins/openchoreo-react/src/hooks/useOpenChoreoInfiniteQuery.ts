import {
  useInfiniteQuery,
  type QueryKey,
  type InfiniteData,
} from '@tanstack/react-query';

/**
 * A single page returned by the fetcher. `items` are the rows for this page and
 * `total` (optional) is the overall server-side count, read off the first page.
 * `hasMore` (optional) overrides the default "page shorter than `pageSize` ends
 * pagination" heuristic — needed when a page is a fan-out/merge of several
 * requests, so its length isn't a clean end-of-list signal.
 */
export interface OpenChoreoPage<TItem> {
  items: TItem[];
  total?: number;
  hasMore?: boolean;
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
   * Derive the cursor for the next page from the last item of the last page.
   * Return `undefined`/`null` to signal there is no next page. Called only when
   * the previous page was "full" (its length === `pageSize`).
   */
  getCursor: (lastItem: TItem) => string | undefined | null;
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
  /** The last error, or null. */
  error: Error | null;
  /** Server-side total from the first page, or the loaded count as a fallback. */
  totalCount: number;
  /** Whether another page can be loaded. */
  hasMore: boolean;
  /** Load the next page (no-op when there is none / already loading). */
  loadMore: () => void;
  /** Re-fetch from page 1. */
  refresh: () => void;
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

  const {
    data,
    error,
    isPending,
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
    queryKey,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    getNextPageParam: lastPage => {
      // Explicit `hasMore` wins (fan-out pages); otherwise a short page ends it.
      const more =
        lastPage.hasMore ?? lastPage.items.length >= pageSize;
      if (!more || lastPage.items.length === 0) return undefined;
      const lastItem = lastPage.items[lastPage.items.length - 1];
      return getCursor(lastItem) ?? undefined;
    },
    enabled,
    refetchInterval,
    staleTime,
  });

  const pages = data?.pages ?? [];
  const items = pages.flatMap(p => p.items);
  const isDisabled = enabled === false;

  return {
    items,
    loading: isPending && !isDisabled,
    loadingMore: isFetchingNextPage,
    error: error ?? null,
    totalCount: pages[0]?.total ?? items.length,
    hasMore: hasNextPage,
    loadMore: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    refresh: () => {
      void refetch();
    },
  };
}
