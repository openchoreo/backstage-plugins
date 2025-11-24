import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for implementing infinite scroll using IntersectionObserver
 *
 * @param callback - Function to call when the user scrolls to the bottom
 * @param hasMore - Whether there is more data to load
 * @param loading - Whether data is currently being loaded
 * @returns An object with a ref to attach to the loading element
 *
 * @example
 * ```tsx
 * const { loadingRef } = useInfiniteScroll(
 *   () => fetchMoreData(),
 *   hasMoreData,
 *   isLoading
 * );
 *
 * return (
 *   <div>
 *     {items.map(item => <ItemComponent key={item.id} item={item} />)}
 *     <div ref={loadingRef}>Loading...</div>
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll(
  callback: () => void,
  hasMore: boolean,
  loading: boolean,
) {
  const [isFetching, setIsFetching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || !hasMore) {
      return () => {};
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isFetching) {
          setIsFetching(true);
          callback();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px',
      },
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, hasMore, loading, isFetching]);

  useEffect(() => {
    if (!loading) {
      setIsFetching(false);
    }
  }, [loading]);

  return { loadingRef };
}
