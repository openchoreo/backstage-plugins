import { Box, Typography } from '@material-ui/core';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export const WorkflowOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const annotations = entity.metadata.annotations || {};
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];
  const description = entity.metadata.description;
  const workflowType = (entity.spec as { type?: string })?.type;

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Workflow Details</Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <PlayCircleOutlineIcon className={classes.statusIcon} />
          <Box>
            <Typography className={classes.statusLabel}>Type</Typography>
            <Typography className={classes.statusValue}>
              {workflowType ? `${workflowType} Workflow` : 'Workflow'}
            </Typography>
          </Box>
        </Box>

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
