import { Box, Chip, Typography } from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import MemoryIcon from '@material-ui/icons/Memory';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const WorkflowRunOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const annotations = entity.metadata.annotations || {};
  const spec = (entity.spec || {}) as Record<string, unknown>;
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];
  const status = spec.status as string | undefined;
  const workflowName = spec.workflowName as string | undefined;
  const description = entity.metadata.description;

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusColor = (s?: string) => {
    switch (s?.toLowerCase()) {
      case 'succeeded':
        return '#4caf50';
      case 'failed':
      case 'error':
        return '#f44336';
      case 'running':
        return '#2196f3';
      case 'pending':
        return '#ff9800';
      default:
        return undefined;
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Workflow Run Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        {status && (
          <Box className={classes.statusItem}>
            <PlayArrowIcon
              className={classes.statusIcon}
              style={{ color: getStatusColor(status) }}
            />
            <Box>
              <Typography className={classes.statusLabel}>Status</Typography>
              <Chip
                label={status}
                size="small"
                style={{
                  backgroundColor: getStatusColor(status),
                  color: '#fff',
                }}
              />
            </Box>
          </Box>
        )}

        {workflowName && (
          <Box className={classes.statusItem}>
            <MemoryIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Workflow</Typography>
              <Typography className={classes.statusValue}>
                {workflowName}
              </Typography>
            </Box>
          </Box>
        )}

        {createdAt && (
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Created</Typography>
              <Typography className={classes.statusValue}>
                {formatDate(createdAt)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {description && (
        <Box mt={2}>
          <Typography className={classes.statusLabel} gutterBottom>
            Description
          </Typography>
          <Typography variant="body2">{description}</Typography>
        </Box>
      )}
    </Card>
  );
};
