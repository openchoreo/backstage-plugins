import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudIcon from '@material-ui/icons/Cloud';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Link } from '@backstage/core-components';
import { useNavigate } from 'react-router-dom';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneEnvironments } from './hooks';
import { useDataplaneOverviewStyles } from './styles';
import { shouldNavigateOnRowClick } from '../../utils/shouldNavigateOnRowClick';

export const DataplaneEnvironmentsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const navigate = useNavigate();
  const { environments, loading, error, refresh } =
    useDataplaneEnvironments(entity);

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <div className={classes.environmentList}>
          {[1, 2, 3].map(i => (
            <div key={i} className={classes.environmentItem}>
              <Skeleton variant="text" width="100%" height={40} />
            </div>
          ))}
        </div>
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
          <IconButton size="small" onClick={refresh}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <div className={classes.environmentList}>
        {environments.map(env => {
          const parsedRef = parseEntityRef(env.entityRef, {
            defaultKind: 'environment',
            defaultNamespace: 'default',
          });
          const envLink = `/catalog/${parsedRef.namespace}/environment/${parsedRef.name}`;
          return (
            <div
              key={env.name}
              className={classes.environmentItem}
              onClick={e => {
                if (shouldNavigateOnRowClick(e)) {
                  navigate(envLink);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(envLink);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Box className={classes.environmentInfo}>
                <CloudIcon style={{ fontSize: '1.2rem', color: 'inherit' }} />
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
            </div>
          );
        })}
      </div>
    </Card>
  );
};
