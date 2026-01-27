import { Box, Typography, Grid } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import { Link, Content } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import { PipelineFlowVisualization } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentPipelines } from './useEnvironmentPipelines';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  pipelineCard: {
    height: '100%',
    padding: theme.spacing(3),
    borderRadius: '12px',
    border: '1px solid rgb(243, 244, 246)',
    boxShadow:
      'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px',
  },
  pipelineHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  pipelineName: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
    color: theme.palette.text.primary,
    textDecoration: 'none',
    '&:hover': {
      color: theme.palette.primary.main,
    },
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(8),
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: '4rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(2),
  },
  loadingCard: {
    padding: theme.spacing(3),
    borderRadius: '12px',
    border: '1px solid rgb(243, 244, 246)',
  },
}));

/**
 * Full-page tab component displaying all deployment pipelines
 * that include the current environment.
 */
export const EnvironmentPipelinesTab = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const { pipelines, loading, error, environmentName } =
    useEnvironmentPipelines();

  if (loading) {
    return (
      <Content>
        <Grid container spacing={3}>
          {[1, 2].map(i => (
            <Grid item xs={12} key={i}>
              <Card className={classes.loadingCard}>
                <Skeleton variant="text" width={200} height={32} />
                <Box mt={2}>
                  <Skeleton variant="rect" width="100%" height={80} />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Content>
    );
  }

  if (error) {
    return (
      <Content>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="h6">Failed to load pipelines</Typography>
          <Typography variant="body2" color="textSecondary">
            {error.message}
          </Typography>
        </Box>
      </Content>
    );
  }

  if (pipelines.length === 0) {
    return (
      <Content>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="h6">No Deployment Pipelines</Typography>
          <Typography variant="body2" color="textSecondary">
            This environment is not part of any deployment pipeline.
          </Typography>
        </Box>
      </Content>
    );
  }

  return (
    <Content>
      <Grid container spacing={3}>
        {pipelines.map(pipeline => (
          <Grid item xs={12} key={pipeline.pipelineEntityRef}>
            <Card className={classes.pipelineCard}>
              <Box className={classes.pipelineHeader}>
                <Link
                  to={(() => {
                    const ref = parseEntityRef(pipeline.pipelineEntityRef, {
                      defaultKind: 'deploymentpipeline',
                      defaultNamespace: 'default',
                    });
                    return `/catalog/${ref.namespace}/${ref.kind}/${ref.name}`;
                  })()}
                  className={classes.pipelineName}
                >
                  {pipeline.pipelineName}
                </Link>
              </Box>
              <PipelineFlowVisualization
                environments={pipeline.environments}
                highlightedEnvironment={environmentName}
                pipelineEntityRef={pipeline.pipelineEntityRef}
                environmentNamespace={entity.metadata.namespace || 'default'}
                showPipelineLink={false}
              />
            </Card>
          </Grid>
        ))}
      </Grid>
    </Content>
  );
};
