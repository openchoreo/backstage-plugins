import {
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Chip,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutlined';
import ErrorIcon from '@material-ui/icons/ErrorOutlined';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import { Card } from '@openchoreo/backstage-design-system';
import {
  useEnvironmentReadPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useDeploymentStatus } from './useDeploymentStatus';
import { useOverviewCardStyles } from './styles';
import type { Environment } from '../hooks/useEnvironmentData';

function getStatusIcon(env: Environment) {
  const status = env.deployment?.status;
  const statusReason = env.deployment?.statusReason;

  if (!status)
    return { Icon: null, iconClass: '', tooltipSuffix: 'Not deployed' };

  // Intentional undeploy — show with a muted icon
  if (statusReason === 'ResourcesUndeployed') {
    return {
      Icon: CloudOffIcon,
      iconClass: 'statusIconDefault' as const,
      tooltipSuffix: 'Undeployed',
    };
  }

  switch (status) {
    case 'Ready':
      return {
        Icon: CheckCircleIcon,
        iconClass: 'statusIconReady' as const,
        tooltipSuffix: 'Deployed (Ready)',
      };
    case 'NotReady':
      return {
        Icon: WarningIcon,
        iconClass: 'statusIconWarning' as const,
        tooltipSuffix: 'Deployed (NotReady)',
      };
    case 'Failed':
      return {
        Icon: ErrorIcon,
        iconClass: 'statusIconError' as const,
        tooltipSuffix: 'Deployed (Failed)',
      };
    default:
      return { Icon: null, iconClass: '', tooltipSuffix: 'Not deployed' };
  }
}

export const DeploymentStatusCard = () => {
  const classes = useOverviewCardStyles();
  const { environments, loading, error, isForbidden, refreshing, refresh } =
    useDeploymentStatus();
  const { canViewEnvironments, loading: permissionLoading } =
    useEnvironmentReadPermission();

  // Loading state
  if (loading || permissionLoading) {
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

  // Permission denied state
  if (isForbidden || !canViewEnvironments) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Deployments</Typography>
        </Box>
        <ForbiddenState
          variant="compact"
          message="You do not have permission to view deployment information."
        />
        <Box className={classes.actions}>
          <Tooltip title="Retry">
            <IconButton
              size="small"
              onClick={refresh}
              disabled={refreshing}
              aria-label="retry"
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
  }

  // Error state
  if (error) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Deployments</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <Typography variant="body2" color="error">
            Failed to load deployment data
          </Typography>
        </Box>
      </Card>
    );
  }

  // No environments
  if (environments.length === 0) {
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

  // Environments exist — show chips
  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Deployments</Typography>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.environmentChips}>
          {environments.map(env => {
            const { Icon, iconClass, tooltipSuffix } = getStatusIcon(env);

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
