import { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import PublicIcon from '@material-ui/icons/Public';
import VisibilityIcon from '@material-ui/icons/Visibility';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';
import WifiIcon from '@material-ui/icons/Wifi';
import WifiOffIcon from '@material-ui/icons/WifiOff';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import clsx from 'clsx';
import { parseEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import {
  CHOREO_ANNOTATIONS,
  RELATION_OBSERVED_BY,
} from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from './styles';

export const DataplaneStatusCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  // Extract dataplane info from entity spec
  const status = annotations[CHOREO_ANNOTATIONS.STATUS] || 'Active';
  const observabilityPlaneRef = spec?.observabilityPlaneRef;
  const publicVirtualHost = spec?.publicVirtualHost;

  // Find the observability plane from entity relations (has correct namespace)
  const observabilityPlaneLink = useMemo(() => {
    const relations = entity.relations || [];
    const observedByRelation = relations.find(
      r =>
        r.type === RELATION_OBSERVED_BY &&
        r.targetRef.includes('observabilityplane'),
    );
    if (!observedByRelation) return null;

    try {
      const ref = parseEntityRef(observedByRelation.targetRef);
      return `/catalog/${ref.namespace}/${ref.kind.toLowerCase()}/${ref.name}`;
    } catch {
      return null;
    }
  }, [entity.relations]);
  const gatewayPort = spec?.gatewayPort;
  const agentConnected =
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED] === 'true';
  const agentCount = parseInt(
    annotations[CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT] || '0',
    10,
  );
  const lastHeartbeat = annotations[CHOREO_ANNOTATIONS.AGENT_LAST_HEARTBEAT];

  // Simulate loading for consistency
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
        <Typography variant="h5">Data Plane Configuration</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CheckCircleIcon
            className={clsx(
              classes.statusIcon,
              status === 'Ready' || status === 'Active'
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
            {observabilityPlaneRef && observabilityPlaneLink ? (
              <Link to={observabilityPlaneLink}>{observabilityPlaneRef}</Link>
            ) : (
              <Typography className={classes.statusValue}>
                Not Configured
              </Typography>
            )}
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

        {gatewayPort && (
          <Box className={classes.statusItem}>
            <SettingsInputComponentIcon
              className={clsx(classes.statusIcon, classes.statusHealthy)}
            />
            <Box>
              <Typography className={classes.statusLabel}>
                Gateway Port
              </Typography>
              <Typography className={classes.statusValue}>
                {gatewayPort}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {publicVirtualHost && (
        <Box style={{ marginTop: 16 }}>
          <Box className={classes.infoRow}>
            <PublicIcon
              style={{ fontSize: '1rem', marginRight: 8, color: 'inherit' }}
            />
            <Typography className={classes.infoLabel}>Public Host:</Typography>
            <Typography className={classes.infoValue}>
              {publicVirtualHost}
            </Typography>
          </Box>
        </Box>
      )}
    </Card>
  );
};
