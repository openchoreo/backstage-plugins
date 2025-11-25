import { Box } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { useLoadingSkeletonStyles } from '../styles';
import { LoadingSkeletonProps } from '../types';

/**
 * Skeleton loading state for environment cards
 */
export const LoadingSkeleton = ({ variant }: LoadingSkeletonProps) => {
  const classes = useLoadingSkeletonStyles();

  if (variant === 'setup') {
    return (
      <Box className={classes.skeletonContainer}>
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton
          variant="rect"
          width="100%"
          height={40}
          style={{ marginTop: 16 }}
        />
      </Box>
    );
  }

  // variant === 'card'
  return (
    <Box className={classes.skeletonContainer}>
      <Skeleton variant="text" width="60%" height={24} />
      <Skeleton
        variant="rect"
        width="100%"
        height={50}
        style={{ marginTop: 12 }}
      />
      <Skeleton variant="text" width="40%" style={{ marginTop: 12 }} />
      <Skeleton variant="text" width="80%" />
      <Skeleton
        variant="rect"
        width="100%"
        height={60}
        style={{ marginTop: 12 }}
      />
    </Box>
  );
};
