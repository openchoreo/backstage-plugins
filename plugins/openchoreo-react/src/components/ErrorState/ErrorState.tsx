import React from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ErrorIcon from '@material-ui/icons/Error';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  icon: {
    fontSize: 48,
    color: theme.palette.error.main,
  },
  message: {
    color: theme.palette.error.main,
    textAlign: 'center',
    maxWidth: 600,
  },
  title: {
    color: theme.palette.error.dark,
    fontWeight: 600,
  },
}));

export interface ErrorStateProps {
  /**
   * Error title (defaults to "Error")
   */
  title?: string;
  /**
   * Error message to display
   */
  message: string;
  /**
   * Optional retry callback
   */
  onRetry?: () => void;
  /**
   * Label for retry button
   * @default "Retry"
   */
  retryLabel?: string;
  /**
   * Whether to show the error icon
   * @default true
   */
  showIcon?: boolean;
  /**
   * Minimum height of the container
   */
  minHeight?: string | number;
}

/**
 * Standardized error state component with icon, message, and optional retry button
 *
 * @example
 * ```tsx
 * if (error) {
 *   return (
 *     <ErrorState
 *       message={error.message}
 *       onRetry={() => refetch()}
 *     />
 *   );
 * }
 * ```
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Retry',
  showIcon = true,
  minHeight,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.container} style={{ minHeight }}>
      {showIcon && <ErrorIcon className={classes.icon} />}
      <Typography variant="h6" className={classes.title}>
        {title}
      </Typography>
      <Typography variant="body2" className={classes.message}>
        {message}
      </Typography>
      {onRetry && (
        <Button variant="outlined" color="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </Box>
  );
};
