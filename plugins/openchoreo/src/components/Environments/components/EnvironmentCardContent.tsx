/* eslint-disable no-nested-ternary */
import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import DescriptionIcon from '@material-ui/icons/Description';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEnvironmentCardStyles } from '../styles';
import { EnvironmentCardContentProps } from '../types';
import { useInvokeUrl } from '../hooks';

/**
 * Content section of an environment card showing deployment details
 */
export const EnvironmentCardContent = ({
  environmentName,
  resourceName,
  status,
  lastDeployed,
  image,
  releaseName,
  endpoints,
  onOpenReleaseDetails,
}: EnvironmentCardContentProps) => {
  const classes = useEnvironmentCardStyles();
  const { entity } = useEntity();

  // State for copy feedback
  const [copiedInvokeUrl, setCopiedInvokeUrl] = useState(false);

  // Fetch invoke URL using custom hook
  const { invokeUrl, loading: loadingInvokeUrl } = useInvokeUrl(
    entity,
    environmentName,
    resourceName,
    releaseName,
    status,
  );

  // Handle copy invoke URL
  const handleCopyInvokeUrl = () => {
    if (invokeUrl) {
      navigator.clipboard.writeText(invokeUrl);
      setCopiedInvokeUrl(true);
      setTimeout(() => setCopiedInvokeUrl(false), 2000);
    }
  };

  return (
    <>
      {lastDeployed && (
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="body2" style={{ fontWeight: 500 }}>
            Deployed
          </Typography>
          <AccessTimeIcon className={classes.timeIcon} />
          <Typography variant="body2" color="textSecondary">
            {formatRelativeTime(lastDeployed)}
          </Typography>
        </Box>
      )}

      <Box display="flex" alignItems="center" mt={2}>
        <Typography variant="body2" style={{ fontWeight: 500, marginRight: 8 }}>
          Deployment Status:
        </Typography>
        <StatusBadge
          status={
            status === 'Ready'
              ? 'active'
              : status === 'NotReady'
              ? 'pending'
              : status === 'Failed'
              ? 'failed'
              : 'not-deployed'
          }
        />
        {releaseName && (
          <IconButton
            onClick={onOpenReleaseDetails}
            size="small"
            title="View release details"
            style={{ marginLeft: 'auto' }}
          >
            <DescriptionIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Invoke URL */}
      {loadingInvokeUrl ? (
        <Box mt={4} mb={3}>
          <Skeleton variant="text" width="30%" height={20} style={{ marginBottom: 8 }} />
          <Skeleton variant="text" width="80%" height={24} />
        </Box>
      ) : (
        invokeUrl && (
          <Box mt={4} mb={3}>
            <Typography
              variant="body2"
              style={{ fontWeight: 500, marginRight: 8 }}
            >
              Invoke URL
            </Typography>
            <Box display="flex" alignItems="center" mt={0.5}>
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <a
                  href={invokeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes.endpointLink}
                >
                  {invokeUrl}
                </a>
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                <Tooltip
                  title={copiedInvokeUrl ? 'Copied' : 'Copy invoke URL'}
                  open={copiedInvokeUrl ? true : undefined}
                  leaveDelay={copiedInvokeUrl ? 0 : 200}
                >
                  <IconButton size="small" onClick={handleCopyInvokeUrl}>
                    <FileCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        )
      )}

      {image && (
        <Box mt={2}>
          <Typography className={classes.sectionLabel}>Image</Typography>
          <Box className={classes.imageContainer}>
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}
            >
              {image}
            </Typography>
          </Box>
        </Box>
      )}

      {status === 'Ready' && endpoints.length > 0 && (
        <Box mt={2}>
          <Typography className={classes.sectionLabel}>Endpoints</Typography>
          {endpoints.map((endpoint, index) => (
            <Box
              key={index}
              display="flex"
              alignItems="center"
              mt={index === 0 ? 0 : 1}
              sx={{ minWidth: 0, width: '100%' }}
            >
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <a
                  href={endpoint.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes.endpointLink}
                >
                  {endpoint.url}
                </a>
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                <IconButton
                  size="small"
                  onClick={() => navigator.clipboard.writeText(endpoint.url)}
                >
                  <FileCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </>
  );
};
