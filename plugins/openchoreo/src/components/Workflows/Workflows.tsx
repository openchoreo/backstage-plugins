import { useState, useCallback, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  Progress,
  ResponseErrorPanel,
  EmptyState,
} from '@backstage/core-components';
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import SettingsIcon from '@material-ui/icons/SettingsOutlined';
import ListAltOutlinedIcon from '@material-ui/icons/ListAltOutlined';
import EditIcon from '@material-ui/icons/Edit';
import CodeIcon from '@material-ui/icons/CodeOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { WorkflowConfigPage } from './WorkflowConfigPage';
import { WorkflowRunDetailsPage } from './WorkflowRunDetailsPage';
import { RunsTab, OverviewTab, BuildWithCommitDialog } from './components';
import { useWorkflowData, useWorkflowRouting } from './hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import {
  useComponentEntityDetails,
  useBuildPermission,
} from '@openchoreo/backstage-plugin-react';
import { useAsyncOperation } from '../../hooks';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: theme.spacing(7.5),
  },
  headerTitle: {
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  container: {
    height: 'calc(100vh - 240px)',
    display: 'flex',
    flexDirection: 'column',
  },
  notFoundContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    padding: theme.spacing(4),
  },
}));

export const Workflows = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { getEntityDetails } = useComponentEntityDetails();
  const {
    canBuild,
    loading: permissionLoading,
    deniedTooltip,
  } = useBuildPermission();

  // URL-based routing
  const {
    state: routingState,
    setTab,
    setRunDetailsTab,
    navigateToList,
    navigateToConfig,
    navigateToRunDetails,
  } = useWorkflowRouting();

  // Dialog state
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);

  // Data fetching hook
  const workflowData = useWorkflowData();

  // Check if component has workflow from componentDetails
  const hasWorkflow = !!workflowData.componentDetails?.componentWorkflow;

  // Find run by ID for run-details view
  const selectedRun = useMemo(() => {
    if (routingState.view !== 'run-details' || !routingState.runId) {
      return undefined;
    }
    return workflowData.builds.find(build => build.name === routingState.runId);
  }, [routingState.view, routingState.runId, workflowData.builds]);

  // Async operation for triggering workflow
  const triggerWorkflowOp = useAsyncOperation(
    useCallback(
      async (commit?: string) => {
        const { componentName, projectName, organizationName } =
          await getEntityDetails();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

        const response = await fetchApi.fetch(`${baseUrl}/builds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            componentName,
            projectName,
            organizationName,
            commit,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await workflowData.fetchBuilds();
      },
      [discoveryApi, fetchApi, getEntityDetails, workflowData],
    ),
  );

  const refreshOp = useAsyncOperation(workflowData.fetchBuilds);

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigateToList();
  }, [navigateToList]);

  const handleOpenConfig = useCallback(() => {
    navigateToConfig();
  }, [navigateToConfig]);

  const handleOpenRunDetails = useCallback(
    (run: ModelsBuild) => {
      if (run.name) {
        navigateToRunDetails(run.name);
      }
    },
    [navigateToRunDetails],
  );

  const handleOpenCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(true);
  }, []);

  const handleCloseCommitDialog = useCallback(() => {
    setIsCommitDialogOpen(false);
  }, []);

  const handleTriggerWithCommit = useCallback(
    async (commit: string) => {
      await triggerWorkflowOp.execute(commit);
    },
    [triggerWorkflowOp],
  );

  // Tab configuration
  const tabs = useMemo<TabItemData[]>(
    () => [
      {
        id: 'runs',
        label: 'Runs',
        icon: <ListAltOutlinedIcon fontSize="small" />,
        count: workflowData.builds.length,
      },
      {
        id: 'configurations',
        label: 'Configurations',
        icon: <SettingsIcon fontSize="small" />,
      },
    ],
    [workflowData.builds.length],
  );

  const renderTabContent = () => {
    switch (routingState.tab) {
      case 'runs':
        return (
          <RunsTab
            builds={workflowData.builds}
            loading={workflowData.loading}
            isRefreshing={refreshOp.isLoading}
            onRefresh={() => refreshOp.execute()}
            onRowClick={handleOpenRunDetails}
          />
        );
      case 'configurations':
        return (
          <OverviewTab
            workflow={workflowData.componentDetails?.componentWorkflow}
          />
        );
      default:
        return null;
    }
  };

  // Loading state
  if (workflowData.loading) {
    return <Progress />;
  }

  // Error state
  if (workflowData.error) {
    return <ResponseErrorPanel error={workflowData.error} />;
  }

  // No workflow state (from-image component)
  if (!hasWorkflow) {
    return (
      <EmptyState
        missing="data"
        title="Workflows Not Available"
        description="This component is configured to use pre-built container images. Workflows are only available for components that build from source code."
      />
    );
  }

  // Config page view
  if (
    routingState.view === 'config' &&
    workflowData.componentDetails?.componentWorkflow
  ) {
    return (
      <WorkflowConfigPage
        workflowName={
          workflowData.componentDetails.componentWorkflow.name || ''
        }
        systemParameters={
          workflowData.componentDetails.componentWorkflow.systemParameters ||
          null
        }
        parameters={
          workflowData.componentDetails.componentWorkflow.parameters || null
        }
        onBack={handleBack}
        onSaved={() => {
          workflowData.fetchComponentDetails();
        }}
      />
    );
  }

  // Run details page view
  if (routingState.view === 'run-details') {
    // Run not found
    if (!selectedRun) {
      return (
        <Box className={classes.notFoundContainer}>
          <Typography variant="h6" gutterBottom>
            Run Not Found
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            The workflow run "{routingState.runId}" could not be found.
          </Typography>
          <Button variant="outlined" onClick={handleBack}>
            Back to Workflows
          </Button>
        </Box>
      );
    }

    return (
      <WorkflowRunDetailsPage
        run={selectedRun}
        onBack={handleBack}
        initialTab={routingState.runDetailsTab}
        onTabChange={setRunDetailsTab}
      />
    );
  }

  // Main list view with vertical tabs
  const { componentDetails } = workflowData;

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h5" className={classes.headerTitle}>
          Workflows
        </Typography>
        <Box className={classes.headerActions}>
          {routingState.tab === 'runs' ? (
            <>
              <Tooltip title={deniedTooltip}>
                <span>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleOpenCommitDialog}
                    startIcon={<CodeIcon />}
                    disabled={
                      !componentDetails?.componentWorkflow ||
                      permissionLoading ||
                      !canBuild
                    }
                  >
                    Build With Commit
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={deniedTooltip}>
                <span>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => triggerWorkflowOp.execute()}
                    disabled={
                      triggerWorkflowOp.isLoading ||
                      !componentDetails?.componentWorkflow ||
                      permissionLoading ||
                      !canBuild
                    }
                    startIcon={
                      triggerWorkflowOp.isLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <PlayArrowIcon />
                      )
                    }
                  >
                    Build Latest
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              {componentDetails?.componentWorkflow && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenConfig}
                  startIcon={<EditIcon />}
                >
                  Edit Configurations
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      <VerticalTabNav
        tabs={tabs}
        activeTabId={routingState.tab}
        onChange={tabId => setTab(tabId as 'runs' | 'configurations')}
      >
        {renderTabContent()}
      </VerticalTabNav>

      <BuildWithCommitDialog
        open={isCommitDialogOpen}
        onClose={handleCloseCommitDialog}
        onTrigger={handleTriggerWithCommit}
        isLoading={triggerWorkflowOp.isLoading}
      />
    </Box>
  );
};
