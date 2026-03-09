import { Box, Typography, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import LockIcon from '@material-ui/icons/Lock';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  compactContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
  icon: {
    fontSize: 48,
    color: theme.palette.text.disabled,
  },
  compactIcon: {
    fontSize: 32,
    color: theme.palette.text.disabled,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  message: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    maxWidth: 600,
  },
  guidance: {
    color: theme.palette.text.hint,
    textAlign: 'center',
    maxWidth: 600,
  },
}));

export interface ForbiddenStateProps {
  title?: string;
  message?: string;
  guidance?: string;
  permissionName?: string;
  variant?: 'default' | 'compact';
  onRetry?: () => void;
  minHeight?: string | number;
}

export const ForbiddenState = ({
  title = 'Insufficient Permissions',
  message = 'You do not have permission to access this resource.',
  guidance = 'Contact your administrator to request access.',
  variant = 'default',
  onRetry,
  minHeight,
}: ForbiddenStateProps) => {
  const classes = useStyles();
  const isCompact = variant === 'compact';

  return (
    <Box
      className={isCompact ? classes.compactContainer : classes.container}
      style={{ minHeight }}
    >
      <LockIcon className={isCompact ? classes.compactIcon : classes.icon} />
      <Typography
        variant={isCompact ? 'body2' : 'h6'}
        className={classes.title}
      >
        {title}
      </Typography>
      {!isCompact && (
        <>
          <Typography variant="body2" className={classes.message}>
            {message}
          </Typography>
          <Typography variant="caption" className={classes.guidance}>
            {guidance}
          </Typography>
        </>
      )}
      {isCompact && (
        <>
          {message && (
            <Typography variant="caption" className={classes.message}>
              {message}
            </Typography>
          )}
          <Typography variant="caption" className={classes.guidance}>
            {guidance}
          </Typography>
        </>
      )}
      {onRetry && (
        <Button variant="outlined" color="primary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Box>
  );
};
