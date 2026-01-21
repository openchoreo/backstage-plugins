import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import PublicIcon from '@material-ui/icons/Public';
import VisibilityIcon from '@material-ui/icons/Visibility';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneOverviewStyles } from './styles';

export const DataplaneStatusCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const spec = entity.spec as any;
  const annotations = entity.metadata.annotations || {};

  // Extract dataplane info from entity spec
  const status = annotations['openchoreo.io/status'] || 'Active';
  const observabilityPlaneRef = spec?.observabilityPlaneRef;
  const publicVirtualHost = spec?.publicVirtualHost;
  const gatewayPort = spec?.gatewayPort;

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

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Data Plane Configuration</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <CheckCircleIcon
            className={clsx(classes.statusIcon, classes.statusHealthy)}
          />
          <Box>
            <Typography className={classes.statusLabel}>Status</Typography>
            <Typography className={classes.statusValue}>{status}</Typography>
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
              {observabilityPlaneRef ? 'Linked' : 'Not Configured'}
            </Typography>
          </Box>
        </Box>

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
