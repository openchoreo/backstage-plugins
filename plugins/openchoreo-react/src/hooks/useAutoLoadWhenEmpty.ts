import { useEffect, useRef } from 'react';

export interface UseAutoLoadWhenEmptyOptions {
  /** Current number of items in the list. */
  count: number;
  /** Whether more items can be loaded. */
  hasMore: boolean;
  /** Whether a load is currently in flight. */
  loading: boolean;
  /** Invoked when the list becomes empty with more available to load. */
  onLoadMore: () => void;
}

/**
 * Trigger `onLoadMore` once when the list becomes empty but the server says
 * there are more pages to fetch. This restores the behaviour the old
 * IntersectionObserver-based sentinel had: when there's nothing to scroll
 * past, the sentinel was immediately in view and fired. With a virtualized
 * list, the sentinel doesn't exist when `count === 0`, so we have to
 * re-create that one-shot trigger explicitly.
 *
 * Fires at most once per "transition into the empty state": if the server
 * keeps returning empty pages with `hasMore: true`, we don't loop. The gate
 * resets when `count` changes (a fresh query, filter switch, or successful
 * fetch), so the next empty state is allowed to try again.
 */
export function useAutoLoadWhenEmpty({
  count,
  hasMore,
  loading,
  onLoadMore,
}: UseAutoLoadWhenEmptyOptions): void {
  const prevCountRef = useRef(count);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (count !== prevCountRef.current) {
      attemptedRef.current = false;
      prevCountRef.current = count;
    }
    if (count === 0 && hasMore && !loading && !attemptedRef.current) {
      attemptedRef.current = true;
      onLoadMore();
    }
  }, [count, hasMore, loading, onLoadMore]);
}
