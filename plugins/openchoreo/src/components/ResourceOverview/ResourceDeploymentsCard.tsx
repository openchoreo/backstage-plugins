import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import { Card, Skeleton } from '@openchoreo/backstage-design-system';
import {
  openChoreoClientApiRef,
  type ResourceEnvironment,
} from '../../api/OpenChoreoClientApi';
import { useOverviewCardStyles } from '../Environments/OverviewCard/styles';

function getEnvStatusIcon(env: ResourceEnvironment) {
  if (!env.bindingName)
    return {
      Icon: CloudOffIcon,
      iconClass: 'statusIconDefault' as const,
      tooltipSuffix: 'Not deployed',
    };
  if (env.status === 'Ready')
    return {
      Icon: CheckCircleIcon,
      iconClass: 'statusIconReady' as const,
      tooltipSuffix: 'Active',
    };
  if (env.status === 'NotReady')
    return {
      Icon: WarningIcon,
      iconClass: 'statusIconWarning' as const,
      tooltipSuffix: 'Pending',
    };
  if (env.status === 'Failed')
    return {
      Icon: ErrorIcon,
      iconClass: 'statusIconError' as const,
      tooltipSuffix: 'Failed',
    };
  return {
    Icon: CloudOffIcon,
    iconClass: 'statusIconDefault' as const,
    tooltipSuffix: 'Not deployed',
  };
}

export const ResourceDeploymentsCard = () => {
  const classes = useOverviewCardStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const [envs, setEnvs] = useState<ResourceEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    (silent: boolean) => {
      let cancelled = false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      client
        .fetchResourceEnvironmentInfo(entity)
        .then(res => {
          if (cancelled) return;
          setEnvs(res ?? []);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          if (cancelled) return;
          if (silent) setRefreshing(false);
          else setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [client, entity],
  );

  useEffect(() => load(false), [load]);

  const refresh = () => {
    load(true);
  };

  if (loading) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={100} height={28} />
        </Box>
        <Box className={classes.content}>
          <Skeleton variant="rect" height={60} />
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Deployments</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <Typography variant="body2" color="error">
            Failed to load environments: {error.message}
          </Typography>
        </Box>
      </Card>
    );
  }

  if (envs.length === 0) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Deployments</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <CloudOffIcon className={classes.disabledIcon} />
          <Typography variant="body2">No environments configured</Typography>
          <Typography variant="caption" color="textSecondary">
            Set up environments from the Deploy tab
          </Typography>
        </Box>
        <Box className={classes.actions}>
          <Link to="environments" style={{ textDecoration: 'none' }}>
            <Button variant="outlined" color="primary" size="small">
              Go to Deploy
            </Button>
          </Link>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Deployments</Typography>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.environmentChips}>
          {envs.map(env => {
            const { Icon, iconClass, tooltipSuffix } = getEnvStatusIcon(env);
            return (
              <Tooltip key={env.name} title={`${env.name}: ${tooltipSuffix}`}>
                <Chip
                  size="small"
                  className={classes.envChip}
                  label={
                    <Box display="flex" alignItems="center" gridGap={4}>
                      <Typography variant="body2">{env.name}</Typography>
                      {Icon && (
                        <Icon
                          className={classes[iconClass]}
                          style={{ fontSize: '18px' }}
                        />
                      )}
                    </Box>
                  }
                  color="default"
                  variant="outlined"
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      <Box className={classes.actions}>
        <Link to="environments" style={{ textDecoration: 'none' }}>
          <Button variant="outlined" color="primary" size="small">
            Go to Deploy
          </Button>
        </Link>
        <Tooltip title="Refresh status">
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
