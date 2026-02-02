import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Content,
  Header,
  Page,
  Progress,
} from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useWorkflows } from '../../hooks/useWorkflows';
import { TriggerWorkflowPage } from '../TriggerWorkflowPage';
import { WorkflowRunDetailsPage } from '../WorkflowRunDetailsPage';
import { WorkflowDetailsPage } from '../WorkflowDetailsPage';
import type { Workflow } from '../../types';

const useStyles = makeStyles(theme => ({
  workflowCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  workflowCardContent: {
    flexGrow: 1,
  },
  workflowName: {
    fontWeight: 600,
  },
  workflowDescription: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
  },
  refreshButton: {
    marginLeft: 'auto',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

// Workflows List Content
const WorkflowsListContent = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { workflows, loading, error, refetch } = useWorkflows();

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error loading workflows</AlertTitle>
        {error.message}
      </Alert>
    );
  }

  if (workflows.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="h6">No workflow templates found</Typography>
        <Typography variant="body2">
          There are no generic workflow templates available in this namespace.
        </Typography>
      </Box>
    );
  }

  return (
    <Content>
      <Box className={classes.headerActions}>
        <Typography variant="h6">
          {workflows.length} Workflow Template{workflows.length !== 1 ? 's' : ''}
        </Typography>
        <IconButton
          className={classes.refreshButton}
          onClick={() => refetch()}
          size="small"
          title="Refresh"
        >
          <RefreshIcon />
        </IconButton>
      </Box>
      <Grid container spacing={3}>
        {workflows.map((workflow: Workflow) => (
          <Grid item xs={12} sm={6} md={4} key={workflow.name}>
            <Card className={classes.workflowCard}>
              <CardContent className={classes.workflowCardContent}>
                <Typography variant="h6" className={classes.workflowName}>
                  {workflow.displayName || workflow.name}
                </Typography>
                {workflow.description && (
                  <Typography
                    variant="body2"
                    className={classes.workflowDescription}
                  >
                    {workflow.description}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  endIcon={<ChevronRightIcon />}
                  onClick={() =>
                    navigate(encodeURIComponent(workflow.name))
                  }
                >
                  View
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Content>
  );
};

export const GenericWorkflowsPage = () => {
  return (
    <Page themeId="tool">
      <Header title="Generic Workflows" subtitle="Manage namespace-level workflow templates" />
      <Routes>
        <Route path="/" element={<WorkflowsListContent />} />
        <Route path="/:workflowName" element={<WorkflowDetailsPage />} />
        <Route path="/:workflowName/trigger" element={<TriggerWorkflowPage />} />
        <Route path="/runs/:runName" element={<WorkflowRunDetailsPage />} />
      </Routes>
    </Page>
  );
};
