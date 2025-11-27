import {
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import LinkIcon from '@material-ui/icons/Link';
import { Card, StatusBadge } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useProductionStatus } from './useProductionStatus';
import { useOverviewCardStyles } from './styles';

/**
 * Maps deployment status to StatusBadge status type
 */
function getStatusBadgeStatus(
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed',
): 'active' | 'pending' | 'failed' | 'not-deployed' {
  switch (deploymentStatus) {
    case 'Ready':
      return 'active';
    case 'NotReady':
      return 'pending';
    case 'Failed':
      return 'failed';
    default:
      return 'not-deployed';
  }
}

export const ProductionOverviewCard = () => {
  const classes = useOverviewCardStyles();
  const {
    productionEnv,
    isDeployed,
    deploymentStatus,
    loading,
    error,
    refreshing,
    refresh,
  } = useProductionStatus();

  // Loading state
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

  // Error state
  if (error) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Production</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <Typography variant="body2" color="error">
            Failed to load deployment data
          </Typography>
        </Box>
      </Card>
    );
  }

  // No production environment configured
  if (!productionEnv) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Production</Typography>
          <Link to="environments" className={classes.viewLink}>
            View All <ArrowForwardIcon fontSize="small" />
          </Link>
        </Box>
        <Box className={classes.disabledState}>
          <CloudOffIcon className={classes.disabledIcon} />
          <Typography variant="body2">
            No production environment configured
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Set up a production environment from the Deploy tab
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

  // Not deployed state
  if (!isDeployed) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Production</Typography>
          <Link to="environments" className={classes.viewLink}>
            View All <ArrowForwardIcon fontSize="small" />
          </Link>
        </Box>
        <Box className={classes.content}>
          <Box className={classes.statusRow}>
            <StatusBadge status="not-deployed" label="Not Deployed" />
          </Box>
          <Typography variant="body2" color="textSecondary">
            Deploy to production from the Deploy tab
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

  // Deployed state
  const { deployment, endpoints } = productionEnv;
  const endpointCount = endpoints?.length || 0;

  // Truncate image for display
  const getDisplayImage = () => {
    if (!deployment?.image) return null;
    if (deployment.image.length > 40) {
      return `...${deployment.image.slice(-37)}`;
    }
    return deployment.image;
  };
  const displayImage = getDisplayImage();

  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Production</Typography>
        <Link to="environments" className={classes.viewLink}>
          View All <ArrowForwardIcon fontSize="small" />
        </Link>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.statusRow}>
          <StatusBadge
            status={getStatusBadgeStatus(deploymentStatus)}
            label={deploymentStatus}
          />
          {deployment?.lastDeployed && (
            <Box className={classes.metaItem}>
              <AccessTimeIcon className={classes.metaIcon} />
              <Typography variant="caption" color="textSecondary">
                {formatRelativeTime(deployment.lastDeployed)}
              </Typography>
            </Box>
          )}
        </Box>

        {displayImage && (
          <Tooltip title={deployment?.image || ''} placement="top">
            <Box className={classes.imageContainer}>{displayImage}</Box>
          </Tooltip>
        )}

        {deploymentStatus === 'Ready' && endpointCount > 0 && (
          <Box className={classes.endpointCount}>
            <LinkIcon className={classes.metaIcon} />
            <span>
              {endpointCount} endpoint{endpointCount !== 1 ? 's' : ''} available
            </span>
          </Box>
        )}
      </Box>

      <Box className={classes.actions}>
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
