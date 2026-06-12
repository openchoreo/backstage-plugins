import {
  CSSProperties,
  ReactNode,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useVirtualizedLogListStyles } from './styles';

export interface VirtualizedLogListProps {
  /** Total number of rows to render. */
  itemCount: number;
  /**
   * Renders the content of a single row. The list measures each row's natural
   * height automatically (via ResizeObserver), so wrapped/variable-height
   * content is handled without any manual measurement — just return the markup.
   */
  renderRow: (index: number) => ReactNode;
  /**
   * Stable key for a row. Recommended so cached measurements survive when the
   * underlying data is appended/refreshed.
   */
  getItemKey?: (index: number) => string | number;
  /**
   * Initial height estimate used before a row is measured. A generous estimate
   * reduces visible layout shift while rows settle in.
   */
  estimatedRowHeight?: number;
  /**
   * Height of the scrollable log area. A number is treated as px; a string is
   * passed through as a CSS value (e.g. `'calc(100vh - 320px)'`). Defaults to
   * 600.
   */
  maxHeight?: number | string;
  /**
   * Auto-scroll to the newest row when rows are appended, as long as the user
   * is already at the bottom. Use for live/streaming logs.
   */
  followTail?: boolean;
  /** Extra rows rendered beyond the viewport on each side. Defaults to 8. */
  overscanCount?: number;
  /** Called when the user scrolls to the end and `hasMore` is true. */
  onReachEnd?: () => void;
  /** Whether more rows can be loaded (gates `onReachEnd`). */
  hasMore?: boolean;
  /** Whether a load is in flight (gates `onReachEnd`). */
  loading?: boolean;
  /**
   * Rendered as a footer pinned to the end of the scrollable list (inside the
   * scroll area). Use for a "loading more…" indicator.
   */
  renderFooter?: () => ReactNode;
  /**
   * Rendered as the first child inside the scroll container. Style it as
   * `position: sticky; top: 0` to keep it visible while the rows scroll. Placed
   * inside the scroller so it shares the rows' content width (i.e. it doesn't
   * misalign when the scrollbar takes width away from the rows).
   */
  renderHeader?: () => ReactNode;
  /** Applied to the outer scroll container. */
  className?: string;
}

const DEFAULT_ESTIMATED_ROW_HEIGHT = 28;
const DEFAULT_MAX_HEIGHT = 600;
const DEFAULT_OVERSCAN = 8;
// How many rows from the end counts as "near the end" for load-more.
const REACH_END_THRESHOLD = 5;
// Pixels of slack when deciding whether the user is "at the bottom" — covers
// sub-pixel rounding so follow-tail isn't disabled by an off-by-one.
const AT_BOTTOM_EPSILON = 4;

/**
 * Headless windowed list for log-style data, built on `@tanstack/react-virtual`.
 * Each row is measured automatically via ResizeObserver (so wrapped/variable
 * heights are handled without manual measurement), and the wrapper owns the
 * three log-shaped behaviours that tanstack itself is too low-level to provide:
 * follow-tail, scroll-driven load-more, and a footer slot.
 */
export const VirtualizedLogList = ({
  itemCount,
  renderRow,
  getItemKey,
  estimatedRowHeight = DEFAULT_ESTIMATED_ROW_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  followTail = false,
  overscanCount = DEFAULT_OVERSCAN,
  onReachEnd,
  hasMore = false,
  loading = false,
  renderFooter,
  renderHeader,
  className,
}: VirtualizedLogListProps) => {
  const classes = useVirtualizedLogListStyles();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tracks whether the viewport is pinned to the bottom (so follow-tail only
  // engages when the user hasn't scrolled away). Updated from the parent
  // scroll handler so it reflects the user's intent, not just initial state.
  const atBottomRef = useRef(true);
  // Guards against re-firing onReachEnd while a load is already pending but
  // `loading` hasn't flipped to true yet (the caller's state update is async).
  const reachEndPendingRef = useRef(false);

  const estimateSize = useCallback(
    () => estimatedRowHeight,
    [estimatedRowHeight],
  );

  // tanstack's getItemKey is required (its default is the index). Hand a real
  // function in both cases so we never accidentally pass `undefined`.
  const itemKeyFn = useCallback(
    (index: number) => (getItemKey ? getItemKey(index) : index),
    [getItemKey],
  );

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: overscanCount,
    getItemKey: itemKeyFn,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Fire onReachEnd when the user scrolls near the last item, gated by
  // hasMore/loading and de-duplicated with a pending flag.
  const lastRenderedIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  useEffect(() => {
    if (!onReachEnd || !hasMore || loading) {
      return;
    }
    if (lastRenderedIndex >= itemCount - 1 - REACH_END_THRESHOLD) {
      if (!reachEndPendingRef.current) {
        reachEndPendingRef.current = true;
        onReachEnd();
      }
    }
  }, [onReachEnd, hasMore, loading, lastRenderedIndex, itemCount]);

  // Once loading flips off we can fire onReachEnd again for the next batch.
  useEffect(() => {
    if (!loading) {
      reachEndPendingRef.current = false;
    }
  }, [loading]);

  // Follow-tail: when rows are appended and the user was at the bottom, pin
  // the viewport to the newest row. Fires only on itemCount growth.
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = itemCount;
    if (followTail && atBottomRef.current && itemCount > prev) {
      virtualizer.scrollToIndex(itemCount - 1, { align: 'end' });
    }
  }, [followTail, itemCount, virtualizer]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_EPSILON;
  }, []);

  const containerStyle = useMemo<CSSProperties>(
    () => ({ height: maxHeight, overflow: 'auto', width: '100%' }),
    [maxHeight],
  );

  const sizerStyle: CSSProperties = {
    height: totalSize,
    width: '100%',
    position: 'relative',
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={className ? `${classes.root} ${className}` : classes.root}
      style={containerStyle}
    >
      {renderHeader ? renderHeader() : null}
      <div style={sizerStyle}>
        {virtualItems.map(item => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            {renderRow(item.index)}
          </div>
        ))}
      </div>
      {renderFooter ? renderFooter() : null}
    </div>
  );
};
