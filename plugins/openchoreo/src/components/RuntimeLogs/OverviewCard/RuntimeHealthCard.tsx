import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import RefreshIcon from '@material-ui/icons/Refresh';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { Card } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useLogsSummary } from './useLogsSummary';
import { useOverviewCardStyles } from './styles';

export const RuntimeHealthCard = () => {
  const classes = useOverviewCardStyles();
  const {
    errorCount,
    warningCount,
    lastActivityTime,
    loading,
    error,
    observabilityDisabled,
    refreshing,
    refresh,
  } = useLogsSummary();

  // Loading state
  if (loading) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={120} height={28} />
        </Box>
        <Box className={classes.content}>
          <Skeleton variant="rect" height={60} />
        </Box>
      </Card>
    );
  }

  // Observability disabled state
  if (observabilityDisabled) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Runtime Health</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <VisibilityOffIcon className={classes.disabledIcon} />
          <Typography variant="body2">Observability not enabled</Typography>
          <Typography variant="caption" color="textSecondary">
            Enable observability to view runtime logs and health metrics
          </Typography>
        </Box>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Runtime Health</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <Typography variant="body2" color="error">
            Failed to load health data
          </Typography>
        </Box>
      </Card>
    );
  }

  // Healthy state (no errors or warnings)
  const isHealthy = errorCount === 0 && warningCount === 0;

  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Runtime Health</Typography>
        <Link to="runtime-logs" className={classes.viewLink}>
          View Logs <ArrowForwardIcon fontSize="small" />
        </Link>
      </Box>

      <Box className={classes.content}>
        <Typography className={classes.timeRangeLabel}>Last 1 hour</Typography>

        {isHealthy ? (
          <Box className={classes.healthyState}>
            <CheckCircleIcon className={classes.healthyIcon} />
            <Typography variant="body2">No errors or warnings</Typography>
          </Box>
        ) : (
          <Box className={classes.countsRow}>
            {errorCount > 0 && (
              <Box className={classes.countItem}>
                <ErrorIcon className={classes.errorCount} fontSize="small" />
                <span className={`${classes.countValue} ${classes.errorCount}`}>
                  {errorCount}
                </span>
                <span className={classes.countLabel}>
                  Error{errorCount !== 1 ? 's' : ''}
                </span>
              </Box>
            )}
            {warningCount > 0 && (
              <Box className={classes.countItem}>
                <WarningIcon
                  className={classes.warningCount}
                  fontSize="small"
                />
                <span
                  className={`${classes.countValue} ${classes.warningCount}`}
                >
                  {warningCount}
                </span>
                <span className={classes.countLabel}>
                  Warning{warningCount !== 1 ? 's' : ''}
                </span>
              </Box>
            )}
          </Box>
        )}

        {lastActivityTime && (
          <Box className={classes.lastActivityRow}>
            <AccessTimeIcon className={classes.metaIcon} />
            <span>Last activity: {formatRelativeTime(lastActivityTime)}</span>
          </Box>
        )}
      </Box>

      <Box className={classes.actions}>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={refresh}
            disabled={refreshing}
            aria-label="refresh"
          >
            {refreshing ? (
              <CircularProgress size={18} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
};
