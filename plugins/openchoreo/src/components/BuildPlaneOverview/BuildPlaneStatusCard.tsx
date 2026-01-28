import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import VisibilityIcon from '@material-ui/icons/Visibility';
import WifiIcon from '@material-ui/icons/Wifi';
import WifiOffIcon from '@material-ui/icons/WifiOff';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const BuildPlaneStatusCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  const status = annotations[CHOREO_ANNOTATIONS.STATUS] || 'Unknown';
  const observabilityPlaneRef = spec?.observabilityPlaneRef;
  const agentConnected =
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED] === 'true';
  const agentCount = parseInt(
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT] || '0',
    10,
  );
  const lastHeartbeat = annotations[CHOREO_ANNOTATIONS.AGENT_LAST_HEARTBEAT];

  const loading = false;

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <Box className={classes.statusGrid}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rect" height={60} />
          ))}
        </Box>
      </Card>
    );
  }

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return isoString;
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Build Plane Configuration</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CheckCircleIcon
            className={clsx(
              classes.statusIcon,
              status === 'Ready'
                ? classes.statusHealthy
                : classes.statusWarning,
            )}
          />
          <Box>
            <Typography className={classes.statusLabel}>Status</Typography>
            <Typography className={classes.statusValue}>{status}</Typography>
          </Box>
        </Box>

        <Box className={classes.statusItem}>
          {agentConnected ? (
            <WifiIcon
              className={clsx(classes.statusIcon, classes.statusHealthy)}
            />
          ) : (
            <WifiOffIcon
              className={clsx(classes.statusIcon, classes.statusError)}
            />
          )}
          <Box>
            <Typography className={classes.statusLabel}>
              Agent Connection
            </Typography>
            <Typography className={classes.statusValue}>
              {agentConnected ? `Connected (${agentCount})` : 'Disconnected'}
            </Typography>
          </Box>
        </Box>

        <Box className={classes.statusItem}>
          <VisibilityIcon
            className={clsx(
              classes.statusIcon,
              observabilityPlaneRef
                ? classes.statusHealthy
                : classes.statusWarning,
            )}
          />
          <Box>
            <Typography className={classes.statusLabel}>
              Observability
            </Typography>
            <Typography className={classes.statusValue}>
              {observabilityPlaneRef || 'Not Configured'}
            </Typography>
          </Box>
        </Box>

        {lastHeartbeat && (
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>
                Last Heartbeat
              </Typography>
              <Typography className={classes.statusValue}>
                {formatRelativeTime(lastHeartbeat)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
};
