import { Box, CircularProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

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
    <Box className={classes.container} style={{ minHeight }}>
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" className={classes.message}>
          {message}
        </Typography>
      )}
    </Box>
  );
};
