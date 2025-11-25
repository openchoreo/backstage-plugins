/* eslint-disable no-nested-ternary */
import { Box, Typography, IconButton } from '@material-ui/core';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import DescriptionIcon from '@material-ui/icons/Description';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentCardStyles } from '../styles';
import { EnvironmentCardContentProps } from '../types';

/**
 * Content section of an environment card showing deployment details
 */
export const EnvironmentCardContent = ({
  status,
  lastDeployed,
  image,
  releaseName,
  endpoints,
  onOpenReleaseDetails,
}: EnvironmentCardContentProps) => {
  const classes = useEnvironmentCardStyles();

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
