import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Chip,
  Divider,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import RefreshIcon from '@material-ui/icons/Refresh';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import LockIcon from '@material-ui/icons/Lock';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { Card, StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useEnvironmentReadPermission,
} from '@openchoreo/backstage-plugin-react';
import { useProductionStatus } from './useProductionStatus';
import { useOverviewCardStyles } from './styles';
import type {
  EndpointInfo,
  EndpointURLDetails,
} from '../hooks/useEnvironmentData';

function buildUrl(details: EndpointURLDetails): string {
  const portPart = details.port ? `:${details.port}` : '';
  const pathPart = details.path || '';
  return `${details.scheme}://${details.host}${portPart}${pathPart}`;
}

function buildServiceUrl(details: EndpointURLDetails): string {
  const portPart = details.port ? `:${details.port}` : '';
  return `${details.scheme}://${details.host}${portPart}`;
}

interface InlineURLRowProps {
  url: string;
  label: string;
}

const InlineURLRow = ({ url, label }: InlineURLRowProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box mb={1}>
      <Chip
        label={label}
        size="small"
        style={{ fontSize: '0.7rem', height: 18, marginBottom: 4 }}
      />
      <Box display="flex" alignItems="center">
        <Box
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.04)',
            borderRadius: 4,
            padding: '4px 8px',
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              wordBreak: 'break-all',
            }}
          >
            {url}
          </Typography>
        </Box>
        <Tooltip
          title={copied ? 'Copied!' : 'Copy URL'}
          open={copied ? true : undefined}
          leaveDelay={copied ? 0 : 200}
        >
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="Copy URL"
            style={{ marginLeft: 4, flexShrink: 0, padding: 4 }}
          >
            <FileCopyOutlinedIcon style={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

interface InlineEndpointsProps {
  endpoints: EndpointInfo[];
}

const InlineEndpoints = ({ endpoints }: InlineEndpointsProps) => {
  if (endpoints.length === 0) return null;

  return (
    <Box mt={1}>
      <Typography variant="body2" style={{ fontWeight: 500, marginBottom: 8 }}>
        Invoke URLs
      </Typography>
      {endpoints.map((endpoint, idx) => (
        <Box key={endpoint.name}>
          {endpoints.length > 1 && (
            <Box display="flex" alignItems="center" mb={1}>
              <Typography variant="caption" style={{ fontWeight: 600 }}>
                {endpoint.name}
              </Typography>
              {endpoint.type && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ marginLeft: 6 }}
                >
                  ({endpoint.type})
                </Typography>
              )}
            </Box>
          )}

          {endpoint.externalURLs &&
            Object.entries(endpoint.externalURLs).map(([protocol, details]) => (
              <InlineURLRow
                key={`ext-${protocol}`}
                url={buildUrl(details)}
                label="External"
              />
            ))}

          {endpoint.internalURLs &&
            Object.entries(endpoint.internalURLs).map(([protocol, details]) => (
              <InlineURLRow
                key={`int-${protocol}`}
                url={buildUrl(details)}
                label="Internal"
              />
            ))}

          {endpoint.serviceURL && (
            <InlineURLRow
              url={buildServiceUrl(endpoint.serviceURL)}
              label="Project"
            />
          )}

          {idx < endpoints.length - 1 && (
            <Divider style={{ margin: '8px 0' }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

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
    isForbidden,
    refreshing,
    refresh,
  } = useProductionStatus();
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
          <Typography className={classes.cardTitle}>Production</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <LockIcon className={classes.disabledIcon} />
          <Typography variant="body2">Insufficient Permissions</Typography>
          <Typography variant="caption" color="textSecondary">
            You do not have permission to view deployment information
          </Typography>
        </Box>
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

        {deploymentStatus === 'Ready' && endpoints?.length > 0 && (
          <InlineEndpoints endpoints={endpoints} />
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
