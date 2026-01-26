import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningIcon from '@material-ui/icons/Warning';
import ErrorIcon from '@material-ui/icons/Error';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { useEnvironmentDeployedComponents } from './hooks';
import { useEnvironmentOverviewStyles } from './styles';

export const EnvironmentStatusSummaryCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const { entity } = useEntity();
  const { statusSummary, loading, error } =
    useEnvironmentDeployedComponents(entity);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={150} height={28} />
        </Box>
        <Box className={classes.statusGrid}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rect" height={60} />
          ))}
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Health
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2" color="error">
            Failed to load status data
          </Typography>
        </Box>
      </Card>
    );
  }

  if (statusSummary.total === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Health
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            No components deployed to this environment
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Deployment Health</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CheckCircleIcon
            className={clsx(classes.statusIcon, classes.statusHealthy)}
          />
          <Box>
            <Typography className={classes.statusCount}>
              {statusSummary.healthy}
            </Typography>
            <Typography className={classes.statusLabel}>Healthy</Typography>
          </Box>
        </Box>

        <Box className={classes.statusItem}>
          <WarningIcon
            className={clsx(classes.statusIcon, classes.statusDegraded)}
          />
          <Box>
            <Typography className={classes.statusCount}>
              {statusSummary.degraded}
            </Typography>
            <Typography className={classes.statusLabel}>Degraded</Typography>
          </Box>
        </Box>

        <Box className={classes.statusItem}>
          <ErrorIcon
            className={clsx(classes.statusIcon, classes.statusFailed)}
          />
          <Box>
            <Typography className={classes.statusCount}>
              {statusSummary.failed}
            </Typography>
            <Typography className={classes.statusLabel}>Failed</Typography>
          </Box>
        </Box>

        <Box className={classes.statusItem}>
          <HourglassEmptyIcon
            className={clsx(classes.statusIcon, classes.statusPending)}
          />
          <Box>
            <Typography className={classes.statusCount}>
              {statusSummary.pending}
            </Typography>
            <Typography className={classes.statusLabel}>Pending</Typography>
          </Box>
        </Box>
      </Box>
    </Card>
  );
};
