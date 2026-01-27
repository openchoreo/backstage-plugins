import { Box, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { Card } from '@openchoreo/backstage-design-system';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useDeploymentPipeline } from '../hooks';
import { useProjectOverviewCardStyles } from './styles';
import { PipelineFlowVisualization } from '@openchoreo/backstage-plugin-react';

export const DeploymentPipelineCard = () => {
  const classes = useProjectOverviewCardStyles();
  const { entity } = useEntity();
  const { data, loading, error } = useDeploymentPipeline();

  // Loading state
  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={150} height={28} />
        </Box>
        <Box className={classes.content}>
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="60%" height={24} />
        </Box>
      </Card>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Pipeline
          </Typography>
        </Box>
        <Box className={classes.disabledState}>
          <ErrorOutlineIcon className={classes.disabledIcon} />
          <Typography variant="body2" color="error">
            Failed to load pipeline data
          </Typography>
        </Box>
      </Card>
    );
  }

  // No pipeline state
  if (!data.environments || data.environments.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Pipeline
          </Typography>
        </Box>
        <Box className={classes.disabledState}>
          <TimelineIcon className={classes.disabledIcon} />
          <Typography variant="body2">
            No deployment pipeline configured
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Deployment Pipeline</Typography>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.pipelineInfo}>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Pipeline:</Typography>
            <Typography className={classes.infoValue}>{data.name}</Typography>
          </Box>

          <Box>
            <Typography className={classes.infoLabel}>Environments</Typography>
            <Box style={{ marginTop: '8px' }}>
              <PipelineFlowVisualization
                environments={data.environments}
                pipelineEntityRef={data.pipelineEntityRef}
                environmentNamespace={entity.metadata.namespace || 'default'}
                showPipelineLink
              />
            </Box>
          </Box>

          {data.dataPlane && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>Data Plane:</Typography>
              <Typography className={classes.infoValue}>
                {data.dataPlane}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
};
