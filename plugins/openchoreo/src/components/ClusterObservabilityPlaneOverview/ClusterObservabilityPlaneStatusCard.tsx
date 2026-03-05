import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WifiIcon from '@material-ui/icons/Wifi';
import WifiOffIcon from '@material-ui/icons/WifiOff';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import LinkIcon from '@material-ui/icons/Link';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const ClusterObservabilityPlaneStatusCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  const status = annotations[CHOREO_ANNOTATIONS.STATUS] || 'Unknown';
  const observerURL =
    spec?.observerURL || annotations[CHOREO_ANNOTATIONS.OBSERVER_URL] || '';
  const agentConnected =
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED] === 'true';
  const parsedAgentCount = parseInt(
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT] || '0',
    10,
  );
  const agentCount = Number.isNaN(parsedAgentCount) ? 0 : parsedAgentCount;
  const lastHeartbeat = annotations[CHOREO_ANNOTATIONS.AGENT_LAST_CONNECTED];

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
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">
          Cluster Observability Plane Configuration
        </Typography>
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

      {observerURL && (
        <Box style={{ marginTop: 16 }}>
          <Box className={classes.infoRow}>
            <LinkIcon
              style={{ fontSize: '1rem', marginRight: 8, color: 'inherit' }}
            />
            <Typography className={classes.infoLabel}>Observer URL:</Typography>
            <Typography className={classes.infoValue}>{observerURL}</Typography>
          </Box>
        </Box>
      )}
    </Card>
  );
};
