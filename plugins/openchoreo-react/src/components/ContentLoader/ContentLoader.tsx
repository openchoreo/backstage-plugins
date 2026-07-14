import { ReactNode } from 'react';
import { Box, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

const useStyles = makeStyles(theme => ({
  /** Wraps content so the refetch overlay can position against it. */
  contentWrap: {
    position: 'relative',
  },
  /**
   * Refetch overlay: a subtle scrim + centered spinner shown ON TOP of
   * already-rendered content. Content stays mounted underneath, so views do
   * not "pop in and out" on a slow background refresh.
   */
  refetchOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    opacity: 0.4,
    pointerEvents: 'none',
    zIndex: 1,
  },
}));

export interface ContentLoaderProps<T> {
  /** First load, no data yet — shows the skeleton. */
  loading: boolean;
  /**
   * Background refresh while data is already present. Keeps content on screen
   * and shows a small overlay spinner instead of swapping back to a loader.
   */
  isRefetching?: boolean;
  /** Error to surface (only shown when there is no data to fall back to). */
  error?: Error | string | null;
  /** The fetched data. Presence of data decides "have we loaded before?". */
  data?: T | null;
  /** Returns true when `data` is present but empty (e.g. `[]`). */
  isEmpty?: (data: T) => boolean;
  /** Retry callback surfaced by the error state. */
  onRetry?: () => void;
  /** Custom first-load placeholder. Defaults to three stacked skeleton lines. */
  skeleton?: ReactNode;
  /** Custom empty state. Defaults to a generic `EmptyState`. */
  emptyState?: ReactNode;
  /** Rendered only with real, non-null data. */
  children: (data: T) => ReactNode;
}

const errorMessage = (error: Error | string) =>
  typeof error === 'string' ? error : error.message;

/**
 * The single loading/error/empty/content decision point for the portal.
 *
 * The important behaviour — and the fix for "cards pop in and out on a slow
 * network" — is that once `data` exists it is ALWAYS rendered; a background
 * refresh (`isRefetching`) shows a small overlay spinner instead of tearing
 * the content down. Only a true first load (no data yet) shows the skeleton.
 *
 * The caller owns the frame (Card/Paper/page layout); this component only
 * decides what goes inside it, so the frame never unmounts.
 *
 * Data init: prefer initializing your hook's data to `null` so "never loaded"
 * and "loaded empty" are distinguishable. If your hook inits to `[]` (common
 * here), pass `isEmpty` — a first load with an empty array still shows the
 * skeleton rather than a flash of the empty state.
 *
 * @example
 * ```tsx
 * <ContentLoader
 *   loading={loading}
 *   isRefetching={isRefetching}
 *   error={error}
 *   data={data}
 *   isEmpty={d => d.items.length === 0}
 *   onRetry={refetch}
 *   emptyState={<EmptyState title="No items" />}
 * >
 *   {d => <ItemList items={d.items} />}
 * </ContentLoader>
 * ```
 */
export function ContentLoader<T>({
  loading,
  isRefetching = false,
  error,
  data,
  isEmpty,
  onRetry,
  skeleton,
  emptyState,
  children,
}: ContentLoaderProps<T>) {
  const classes = useStyles();
  const present = data !== null && data !== undefined;
  // A hook that inits data to `[]` (the dominant pattern in this repo) reports
  // "present but empty" from the very first render. Treat that as "no data yet"
  // during a first load so we show the skeleton, not a flash of the empty state.
  const emptyOnFirstLoad =
    present && loading && (isEmpty?.(data as T) ?? false);
  const hasData = present && !emptyOnFirstLoad;

  // First load, nothing to show yet → skeleton.
  if (loading && !hasData) {
    return <>{skeleton ?? <Skeleton count={3} />}</>;
  }

  // Errored with no data to fall back to → error state.
  if (error && !hasData) {
    return (
      <Box role="status" aria-busy="false">
        <ErrorState message={errorMessage(error)} onRetry={onRetry} />
      </Box>
    );
  }

  // Have data → always render it. If empty, show the empty state instead.
  if (hasData) {
    if (isEmpty?.(data as T)) {
      return <>{emptyState ?? <EmptyState title="No data available" />}</>;
    }

    return (
      <Box className={classes.contentWrap} aria-busy={isRefetching}>
        {children(data as T)}
        {isRefetching && (
          <Box className={classes.refetchOverlay} data-testid="refetch-overlay">
            <CircularProgress size={24} aria-label="Refreshing" />
          </Box>
        )}
      </Box>
    );
  }

  // No data, not loading, no error (e.g. a not-yet-started fetch) → nothing.
  return null;
}
