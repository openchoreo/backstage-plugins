import { makeStyles, Theme } from '@material-ui/core/styles';
import { Box, CircularProgress, LinearProgress } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) => ({
  // Corner badge — mirrors the deploy pipeline's `canvasRefetchOverlay` so
  // every cached surface converges on one background-refresh treatment.
  corner: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    // Never intercept clicks on the content underneath.
    pointerEvents: 'none',
    zIndex: 5,
  },
  // Thin indeterminate bar pinned to the top edge of the host.
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    pointerEvents: 'none',
    // Honour reduced-motion: MUI runs the indeterminate sweep on the inner bar
    // elements, so freeze those (the class-level `animation: none` misses them).
    '@media (prefers-reduced-motion: reduce)': {
      '& .MuiLinearProgress-bar1Indeterminate': { animation: 'none' },
      '& .MuiLinearProgress-bar2Indeterminate': { animation: 'none' },
    },
  },
  spinner: {
    // Honour reduced-motion: freeze the sweep rather than spinning.
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
}));

export interface RefreshOverlayProps {
  /**
   * True while a background refresh runs with data already on screen — i.e.
   * the `isRefetching` flag from `useOpenChoreoQuery`. When false, nothing
   * renders.
   */
  active: boolean;
  /**
   * `corner` (default) floats a small spinner top-right without shifting
   * layout; `bar` draws a thin indeterminate progress bar across the top edge.
   */
  variant?: 'corner' | 'bar';
  /** Accessible label announced to assistive tech. Default: "Refreshing". */
  label?: string;
}

/**
 * A subtle "refreshing in the background" indicator for cached surfaces.
 *
 * Drop it inside any positioned (`position: relative`) container that renders
 * cached data. It overlays without displacing content, so a background
 * revalidation shows a quiet indicator instead of blanking to a skeleton.
 *
 * @example
 * ```tsx
 * const { data, isRefetching } = useOpenChoreoQuery(...);
 * return (
 *   <Card style={{ position: 'relative' }}>
 *     <RefreshOverlay active={isRefetching} />
 *     {/* cached content, unchanged *\/}
 *   </Card>
 * );
 * ```
 */
export const RefreshOverlay = ({
  active,
  variant = 'corner',
  label = 'Refreshing',
}: RefreshOverlayProps) => {
  const classes = useStyles();

  if (!active) return null;

  if (variant === 'bar') {
    return (
      <LinearProgress
        className={classes.bar}
        role="status"
        aria-label={label}
      />
    );
  }

  return (
    <Box className={classes.corner} role="status" aria-label={label}>
      <CircularProgress
        size={16}
        className={classes.spinner}
        aria-hidden="true"
      />
    </Box>
  );
};
