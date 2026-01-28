import { Box, Typography, List, ListItem, Button } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import { Link } from '@backstage/core-components';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import { useEnvironmentOverviewStyles } from './styles';
import { useEnvironmentPipelines } from './useEnvironmentPipelines';
import { makeStyles } from '@material-ui/core/styles';

const MAX_VISIBLE_PIPELINES = 3;

const useLocalStyles = makeStyles(theme => ({
  headerWithAction: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  viewAllButton: {
    textTransform: 'none',
    fontSize: theme.typography.caption.fontSize,
  },
  list: {
    padding: 0,
  },
  listItem: {
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  pipelineInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    flex: 1,
  },
  pipelineLink: {
    textDecoration: 'none',
    color: theme.palette.text.primary,
    '&:hover': {
      color: theme.palette.primary.main,
    },
  },
  pipelineName: {
    fontWeight: 500,
    fontSize: theme.typography.body2.fontSize,
  },
  pipelinePath: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
  chevron: {
    color: theme.palette.text.secondary,
    fontSize: '1.2rem',
    marginTop: theme.spacing(0.5),
  },
}));

export const EnvironmentPromotionCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const localClasses = useLocalStyles();
  const { pipelines, loading, error } = useEnvironmentPipelines();

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <Skeleton variant="text" width="100%" height={24} />
        <Skeleton variant="text" width="80%" height={24} />
      </Card>
    );
  }

  if (error || pipelines.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Pipelines
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <TimelineIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            {error
              ? 'Failed to load pipeline data'
              : 'No deployment pipeline configured for this environment'}
          </Typography>
        </Box>
      </Card>
    );
  }

  const visiblePipelines = pipelines.slice(0, MAX_VISIBLE_PIPELINES);

  const formatPipelinePath = (environments: string[]) => {
    return environments.join(' → ');
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={localClasses.headerWithAction}>
        <Typography variant="h5">Deployment Pipelines</Typography>
        <Link to="pipelines" style={{ textDecoration: 'none' }}>
          <Button
            size="small"
            color="primary"
            endIcon={<ArrowForwardIcon />}
            className={localClasses.viewAllButton}
          >
            View All
          </Button>
        </Link>
      </Box>

      <Box className={classes.content}>
        <List className={localClasses.list}>
          {visiblePipelines.map(pipeline => (
            <ListItem
              key={pipeline.pipelineEntityRef}
              className={localClasses.listItem}
              disableGutters
            >
              <Box className={localClasses.pipelineInfo}>
                <Link
                  to={(() => {
                    const ref = parseEntityRef(pipeline.pipelineEntityRef, {
                      defaultKind: 'deploymentpipeline',
                      defaultNamespace: 'default',
                    });
                    return `/catalog/${ref.namespace}/${ref.kind}/${ref.name}`;
                  })()}
                  className={localClasses.pipelineLink}
                >
                  <Typography className={localClasses.pipelineName}>
                    {pipeline.pipelineName}
                  </Typography>
                </Link>
                <Typography className={localClasses.pipelinePath}>
                  {formatPipelinePath(pipeline.environments)}
                </Typography>
              </Box>
              <Link
                to={(() => {
                  const ref = parseEntityRef(pipeline.pipelineEntityRef, {
                    defaultKind: 'deploymentpipeline',
                    defaultNamespace: 'default',
                  });
                  return `/catalog/${ref.namespace}/${ref.kind}/${ref.name}`;
                })()}
                style={{ textDecoration: 'none' }}
              >
                <ChevronRightIcon className={localClasses.chevron} />
              </Link>
            </ListItem>
          ))}
        </List>
      </Box>
    </Card>
  );
};
