import { CSSProperties } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import { useChoreoTokens } from '../../theme/useChoreoTokens';

/**
 * Shared shimmer keyframe so every placeholder animates identically. Colours
 * come from `graph.skeletonStops`, timing/easing from the `motion` tokens.
 */
const useStyles = makeStyles((theme: Theme) => ({
  '@keyframes ocShimmer': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
  skeleton: {
    display: 'block',
    backgroundSize: '200% 100%',
    animationName: '$ocShimmer',
    animationIterationCount: 'infinite',
  },
  text: {
    height: '1em',
    marginTop: 0,
    marginBottom: 0,
    borderRadius: theme.shape.borderRadius,
    transform: 'scale(1, 0.7)',
    transformOrigin: '0 60%',
  },
  rect: {
    borderRadius: theme.shape.borderRadius,
  },
  circle: {
    borderRadius: '50%',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

export interface SkeletonProps {
  /**
   * Shape of the placeholder.
   * @default 'text'
   */
  variant?: 'text' | 'rect' | 'circle';
  /** Width (number = px). Defaults to 100% for text/rect. */
  width?: number | string;
  /** Height (number = px). Defaults to a line height for text. */
  height?: number | string;
  /**
   * Render N stacked placeholder lines. Replaces the ad-hoc
   * `Array.from({ length: n }).map(...)` loops scattered across the app.
   * @default 1
   */
  count?: number;
  className?: string;
  /** Extra inline styles, merged over the shimmer style (caller wins). */
  style?: CSSProperties;
  /** Test id on each placeholder element. @default 'skeleton' */
  'data-testid'?: string;
}

/**
 * The single, token-driven loading placeholder for the OpenChoreo portal.
 *
 * Prefer this over raw MUI `Skeleton` / `CircularProgress` for first-load
 * placeholders so shimmer colour and timing stay consistent everywhere. For
 * combined loading/error/empty/content handling that keeps content on screen
 * during refetch, wrap views in `ContentLoader` (from
 * `@openchoreo/backstage-plugin-react`), which uses this primitive.
 *
 * @example
 * ```tsx
 * <Skeleton variant="rect" height={120} />
 * <Skeleton count={3} />           // three stacked text lines
 * ```
 */
export const Skeleton = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className,
  style,
  'data-testid': dataTestId = 'skeleton',
}: SkeletonProps) => {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  // base → mid → base only (drops the bright highlight stop) to keep the sweep
  // subtle.
  const [base, mid] = tokens.graph.skeletonStops;

  const shimmerStyle: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${base} 15%, ${mid} 50%, ${base} 85%)`,
    animationDuration: tokens.motion.shimmerDuration,
    animationTimingFunction: tokens.motion.shimmerEasing,
    width: width ?? (variant === 'circle' ? height : '100%'),
    height,
  };

  const variantClass = {
    text: classes.text,
    rect: classes.rect,
    circle: classes.circle,
  }[variant];

  const item = (key?: number) => (
    <Box
      key={key}
      className={[classes.skeleton, variantClass, className]
        .filter(Boolean)
        .join(' ')}
      style={{ ...shimmerStyle, ...style }}
      aria-hidden="true"
      data-testid={dataTestId}
    />
  );

  if (count > 1) {
    return (
      <Box className={classes.stack} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => item(i))}
      </Box>
    );
  }

  return item();
};
