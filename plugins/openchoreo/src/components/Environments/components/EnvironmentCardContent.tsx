/* eslint-disable no-nested-ternary */
import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
} from '@material-ui/core';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import VisibilityOutlinedIcon from '@material-ui/icons/VisibilityOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentCardStyles } from '../styles';
import { EnvironmentCardContentProps } from '../types';
import { InvokeUrlsDialog } from './InvokeUrlsDialog';
import { IncidentsBanner } from './IncidentsBanner';

/**
 * Content section of an environment card showing deployment details
 */
export const EnvironmentCardContent = ({
  status,
  statusReason,
  statusMessage,
  lastDeployed,
  image,
  releaseName,
  endpoints,
  onOpenReleaseDetails,
  activeIncidentCount,
  environmentName,
}: EnvironmentCardContentProps) => {
  const classes = useEnvironmentCardStyles();

  const [invokeUrlsOpen, setInvokeUrlsOpen] = useState(false);

  const hasInvokeUrls = status === 'Ready' && endpoints.length > 0;

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

      <Box mt={2}>
        <Box display="flex" alignItems="center">
          <Typography
            variant="body2"
            style={{ fontWeight: 500, marginRight: 8 }}
          >
            Deployment Status:
          </Typography>
          <Tooltip
            title={
              statusReason && statusMessage
                ? `${statusReason}: ${statusMessage}`
                : statusReason ?? statusMessage ?? ''
            }
            disableHoverListener={!statusReason && !statusMessage}
          >
            <span>
              <StatusBadge
                status={
                  statusReason === 'ResourcesUndeployed'
                    ? 'undeployed'
                    : status === 'Ready'
                    ? 'active'
                    : status === 'NotReady'
                    ? 'pending'
                    : status === 'Failed'
                    ? 'failed'
                    : 'not-deployed'
                }
              />
            </span>
          </Tooltip>
        </Box>
        {releaseName && (
          <Box mt={1.5}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<DescriptionOutlinedIcon />}
              onClick={onOpenReleaseDetails}
              style={{ textTransform: 'none' }}
            >
              View K8s Artifacts
            </Button>
          </Box>
        )}
      </Box>

      {status &&
        activeIncidentCount !== undefined &&
        activeIncidentCount > 0 &&
        environmentName && (
          <IncidentsBanner
            count={activeIncidentCount}
            environmentName={environmentName}
          />
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

      {hasInvokeUrls && (
        <Box
          mt={2}
          mb={2}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box display="flex" alignItems="center">
            <Typography
              variant="body2"
              style={{ fontWeight: 500, marginRight: 6 }}
            >
              Invoke URLs
            </Typography>
            <Box
              style={{
                backgroundColor: 'rgba(0,0,0,0.08)',
                borderRadius: 10,
                padding: '0px 7px',
                lineHeight: '18px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" color="textSecondary">
                {endpoints.length}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="View invoke URLs">
            <IconButton
              size="small"
              onClick={() => setInvokeUrlsOpen(true)}
              aria-label="Show invoke URLs"
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <InvokeUrlsDialog
        open={invokeUrlsOpen}
        onClose={() => setInvokeUrlsOpen(false)}
        endpoints={endpoints}
      />
    </>
  );
};
