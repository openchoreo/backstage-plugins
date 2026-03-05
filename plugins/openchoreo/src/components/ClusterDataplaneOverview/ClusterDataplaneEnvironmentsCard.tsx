import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import LaunchIcon from '@material-ui/icons/Launch';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Link } from '@backstage/core-components';
import { Card } from '@openchoreo/backstage-design-system';
import { useClusterDataplaneEnvironments } from './hooks';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const ClusterDataplaneEnvironmentsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const { environments, loading, error, refresh } =
    useClusterDataplaneEnvironments(entity);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <ul className={classes.environmentList}>
          {[1, 2, 3].map(i => (
            <li key={i} className={classes.environmentItem}>
              <Skeleton variant="text" width="100%" height={40} />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Hosted Environments
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2" color="error">
            Failed to load environments
          </Typography>
        </Box>
      </Card>
    );
  }

  if (environments.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Hosted Environments
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            No environments configured on this data plane
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Hosted Environments</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={refresh} aria-label="Refresh">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <ul className={classes.environmentList}>
        {environments.map(env => {
          const parsedRef = parseEntityRef(env.entityRef, {
            defaultKind: 'environment',
            defaultNamespace: 'default',
          });
          const envLink = `/catalog/${parsedRef.namespace}/environment/${parsedRef.name}`;
          return (
            <li key={env.name} className={classes.environmentItem}>
              <Box className={classes.environmentInfo}>
                <Link to={envLink} className={classes.environmentName}>
                  {env.displayName || env.name}
                </Link>
                <Typography
                  className={clsx(
                    classes.environmentType,
                    env.isProduction
                      ? classes.productionBadge
                      : classes.nonProductionBadge,
                  )}
                >
                  {env.isProduction ? 'prod' : 'non-prod'}
                </Typography>
              </Box>

              <Box className={classes.environmentStats}>
                <Tooltip title="View Environment">
                  <IconButton
                    size="small"
                    component={Link}
                    to={envLink}
                    aria-label="View Environment"
                  >
                    <LaunchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
