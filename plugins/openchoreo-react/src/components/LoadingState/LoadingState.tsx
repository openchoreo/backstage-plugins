import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Spinner, VisuallyHidden } from '@openchoreo/backstage-design-system';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  message: {
    color: theme.palette.text.secondary,
  },
}));

export interface LoadingStateProps {
  /**
   * Optional loading message to display below the spinner
   */
  message?: string;
  /**
   * Size of the CircularProgress spinner
   * @default 40
   */
  size?: number;
  /**
   * Minimum height of the container
   */
  minHeight?: string | number;
}

/**
 * Standardized loading state component with spinner and optional message
 *
 * @example
 * ```tsx
 * if (loading) {
 *   return <LoadingState message="Loading data..." />;
 * }
 * ```
 */
export const LoadingState = ({
  message = 'Loading...',
  size = 40,
  minHeight,
}: LoadingStateProps) => {
  const classes = useStyles();

  return (
    <Box
      className={classes.container}
      style={{ minHeight }}
      role="status"
      aria-busy="true"
    >
      <Spinner size={size} aria-label="Loading" />
      {message ? (
        <Typography variant="body2" className={classes.message}>
          {message}
        </Typography>
      ) : (
        <VisuallyHidden>Loading</VisuallyHidden>
      )}
    </Box>
  );
};
