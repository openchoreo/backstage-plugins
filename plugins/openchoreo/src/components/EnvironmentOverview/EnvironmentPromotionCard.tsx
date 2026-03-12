import { Box, Typography, List, ListItem } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import { Link } from '@backstage/core-components';
import { useNavigate } from 'react-router-dom';
import { parseEntityRef } from '@backstage/catalog-model';
import { Card } from '@openchoreo/backstage-design-system';
import { useEnvironmentOverviewStyles } from './styles';
import { useEnvironmentPipelines } from './useEnvironmentPipelines';
import { shouldNavigateOnRowClick } from '../../utils/shouldNavigateOnRowClick';
import { makeStyles } from '@material-ui/core/styles';

const MAX_VISIBLE_PIPELINES = 3;

const useLocalStyles = makeStyles(theme => ({
  headerWithAction: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  list: {
    padding: 0,
    margin: 0,
    listStyle: 'none',
  },
  listItem: {
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:last-child': {
      marginBottom: 0,
    },
  },
  pipelineInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
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
  pipelineSeparator: {
    color: theme.palette.text.disabled,
    fontSize: theme.typography.caption.fontSize,
  },
  pipelinePath: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
}));

export const EnvironmentPromotionCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const localClasses = useLocalStyles();
  const navigate = useNavigate();
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
            Pipelines Deploying to this Environment
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
        <Typography variant="h5">
          Pipelines Deploying to this Environment
        </Typography>
      </Box>

      <Box className={classes.content}>
        <List className={localClasses.list}>
          {visiblePipelines.map(pipeline => {
            const ref = parseEntityRef(pipeline.pipelineEntityRef, {
              defaultKind: 'deploymentpipeline',
              defaultNamespace: 'default',
            });
            const pipelineLink = `/catalog/${ref.namespace}/${ref.kind}/${ref.name}`;
            return (
              <ListItem
                key={pipeline.pipelineEntityRef}
                className={localClasses.listItem}
                disableGutters
                onClick={e => {
                  if (shouldNavigateOnRowClick(e)) {
                    navigate(pipelineLink);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(pipelineLink);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Box className={localClasses.pipelineInfo}>
                  <AccountTreeIcon
                    style={{ fontSize: '1.2rem', color: 'inherit' }}
                  />
                  <Link to={pipelineLink} className={localClasses.pipelineLink}>
                    <Typography className={localClasses.pipelineName}>
                      {pipeline.pipelineName}
                    </Typography>
                  </Link>
                  <Typography className={localClasses.pipelineSeparator}>
                    —
                  </Typography>
                  <Typography className={localClasses.pipelinePath}>
                    {formatPipelinePath(pipeline.environments)}
                  </Typography>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Card>
  );
};
