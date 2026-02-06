import { useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Content,
  Header,
  Page,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
import { useAsync } from 'react-use';
import { useWorkflows } from '../../hooks/useWorkflows';
import { NamespaceProvider, useNamespaceContext } from '../../context';
import { TriggerWorkflowPage } from '../TriggerWorkflowPage';
import { WorkflowRunDetailsPage } from '../WorkflowRunDetailsPage';
import { WorkflowDetailsPage } from '../WorkflowDetailsPage';
import type { Workflow } from '../../types';

const useStyles = makeStyles(theme => ({
  namespaceSelector: {
    minWidth: 300,
    marginBottom: theme.spacing(3),
  },
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
  const client = useApi(openChoreoClientApiRef);
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext();

  // Fetch available namespaces
  const {
    value: namespaces,
    loading: namespacesLoading,
    error: namespacesError,
  } = useAsync(async () => {
    return client.listNamespaces();
  }, [client]);

  // Fetch workflows for the selected namespace (reads from context)
  const {
    workflows,
    loading: workflowsLoading,
    error: workflowsError,
    refetch,
  } = useWorkflows();

  const handleNamespaceChange = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    setSelectedNamespace(event.target.value as string);
  };

  // Sort namespaces alphabetically
  const sortedNamespaces = useMemo(() => {
    if (!namespaces) return [];
    return [...namespaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [namespaces]);

  return (
    <Content>
      {/* Namespace Selector */}
      <FormControl variant="outlined" className={classes.namespaceSelector}>
        <InputLabel id="namespace-select-label">Namespace</InputLabel>
        <Select
          labelId="namespace-select-label"
          label="Namespace"
          value={selectedNamespace}
          onChange={handleNamespaceChange}
          disabled={namespacesLoading}
        >
          {namespacesLoading && (
            <MenuItem disabled>
              <CircularProgress size={20} style={{ marginRight: 8 }} />
              Loading namespaces...
            </MenuItem>
          )}
          {!namespacesLoading && sortedNamespaces.length === 0 && (
            <MenuItem disabled>No namespaces available</MenuItem>
          )}
          {!namespacesLoading &&
            sortedNamespaces.map(ns => (
              <MenuItem key={ns.name} value={ns.name}>
                {ns.displayName || ns.name}
              </MenuItem>
            ))}
        </Select>
      </FormControl>

      {/* Error Display */}
      {namespacesError && (
        <WarningPanel severity="error" title="Failed to load namespaces">
          <Typography>
            {namespacesError.message ||
              'An error occurred while loading namespaces.'}
          </Typography>
        </WarningPanel>
      )}

      {workflowsError && (
        <WarningPanel severity="error" title="Failed to load workflows">
          <Typography>
            {workflowsError.message ||
              'An error occurred while loading workflows.'}
          </Typography>
        </WarningPanel>
      )}

      {/* Content */}
      {!selectedNamespace && (
        <Box className={classes.emptyState}>
          <Typography variant="h6">
            Select a namespace to view workflow templates
          </Typography>
        </Box>
      )}

      {selectedNamespace && workflowsLoading && <Progress />}

      {selectedNamespace && !workflowsLoading && workflows.length === 0 && (
        <Box className={classes.emptyState}>
          <Typography variant="h6">No workflow templates found</Typography>
          <Typography variant="body2">
            There are no generic workflow templates available in this namespace.
          </Typography>
        </Box>
      )}

      {selectedNamespace && !workflowsLoading && workflows.length > 0 && (
        <>
          <Box className={classes.headerActions}>
            <Typography variant="h6">
              {workflows.length} Workflow Template
              {workflows.length !== 1 ? 's' : ''}
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
        </>
      )}
    </Content>
  );
};

export const GenericWorkflowsPage = () => {
  return (
    <NamespaceProvider>
      <Page themeId="tool">
        <Header
          title="Generic Workflows"
          subtitle="Manage namespace-level workflow templates"
        />
        <Routes>
          <Route path="/" element={<WorkflowsListContent />} />
          <Route path="/:workflowName" element={<WorkflowDetailsPage />} />
          <Route
            path="/:workflowName/trigger"
            element={<TriggerWorkflowPage />}
          />
          <Route path="/runs/:runName" element={<WorkflowRunDetailsPage />} />
        </Routes>
      </Page>
    </NamespaceProvider>
  );
};
