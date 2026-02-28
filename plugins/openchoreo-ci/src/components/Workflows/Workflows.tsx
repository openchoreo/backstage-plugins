import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  Progress,
  ResponseErrorPanel,
  EmptyState,
  WarningIcon,
} from '@backstage/core-components';
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Tooltip,
} from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import SettingsIcon from '@material-ui/icons/SettingsOutlined';
import ListAltOutlinedIcon from '@material-ui/icons/ListAltOutlined';
import EditIcon from '@material-ui/icons/Edit';
import CodeIcon from '@material-ui/icons/CodeOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { WorkflowConfigPage } from '../WorkflowConfigPage';
import { WorkflowRunDetailsPage } from '../WorkflowRunDetailsPage';
import { RunsTab } from '../RunsTab';
import { OverviewTab } from '../OverviewTab';
import { BuildWithCommitDialog } from '../BuildWithCommitDialog';
import { useWorkflowData, useWorkflowRouting } from '../../hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import {
  CHOREO_LABELS,
  CHOREO_ANNOTATIONS,
  parseWorkflowParametersAnnotation,
} from '@openchoreo/backstage-plugin-common';
import {
  useComponentEntityDetails,
  useBuildPermission,
  useAsyncOperation,
} from '@openchoreo/backstage-plugin-react';
import { useStyles } from './styles';

/**
 * Set a value at a dot-delimited path in a nested object.
 * The path should be relative to the parameters root (strip "parameters." prefix first).
 */
function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: any,
): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

export const Workflows = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);
  const { getEntityDetails } = useComponentEntityDetails();
  const {
    canBuild,
    canView,
    triggerLoading: permissionLoading,
    viewLoading,
    triggerBuildDeniedTooltip: deniedTooltip,
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

  // Commit annotation path — non-null only when the workflow annotation has a `commit` key
  const [commitParamPath, setCommitParamPath] = useState<string | null>(null);

  // Data fetching hook
  const workflowData = useWorkflowData();

  // Check if component has workflow from componentDetails
  const hasWorkflow = !!workflowData.componentDetails?.componentWorkflow;

  // Fetch WORKFLOW_PARAMETERS annotation to check if `commit` key exists
  const workflowName = workflowData.componentDetails?.componentWorkflow?.name;
  useEffect(() => {
    let ignore = false;

    const fetchCommitAnnotation = async () => {
      if (!workflowName) {
        setCommitParamPath(null);
        return;
      }

      try {
        const { namespaceName } = await getEntityDetails();
        const response = await catalogApi.getEntities({
          filter: {
            kind: 'Workflow',
            'metadata.name': workflowName,
            'metadata.namespace': namespaceName,
          },
        });

        if (ignore) return;

        const workflowEntity = response.items[0];
        const annotation =
          workflowEntity?.metadata?.annotations?.[
            CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS
          ];

        if (annotation) {
          const mapping = parseWorkflowParametersAnnotation(annotation);
          setCommitParamPath(mapping.commit ?? null);
        } else {
          setCommitParamPath(null);
        }
      } catch {
        if (!ignore) {
          setCommitParamPath(null);
        }
      }
    };

    fetchCommitAnnotation();
    return () => {
      ignore = true;
    };
  }, [workflowName, catalogApi, getEntityDetails]);

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
        const { componentName, projectName, namespaceName } =
          await getEntityDetails();
        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-workflows-backend',
        );

        const workflow = workflowData.componentDetails?.componentWorkflow;
        if (!workflow?.name) {
          throw new Error('No workflow configured for this component');
        }

        // Clone workflow parameters so we can inject commit without mutating the original
        const parameters = workflow.parameters
          ? JSON.parse(JSON.stringify(workflow.parameters))
          : {};

        // If a commit was provided and the annotation defines a commit path, inject it
        if (commit && commitParamPath) {
          const path = commitParamPath.startsWith('parameters.')
            ? commitParamPath.slice('parameters.'.length)
            : commitParamPath;
          setNestedValue(parameters, path, commit);
        }

        const response = await fetchApi.fetch(
          `${baseUrl}/workflow-runs?namespaceName=${encodeURIComponent(
            namespaceName,
          )}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workflowName: workflow.name,
              workflowRunName: `${componentName}-${Date.now()}`,
              parameters,
              labels: {
                [CHOREO_LABELS.WORKFLOW_PROJECT]: projectName,
                [CHOREO_LABELS.WORKFLOW_COMPONENT]: componentName,
              },
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await workflowData.fetchBuilds();
      },
      [discoveryApi, fetchApi, getEntityDetails, workflowData, commitParamPath],
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
            commitParamPath={commitParamPath}
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

  if (!canView && !viewLoading) {
    return (
      <EmptyState
        missing="data"
        title="Permission Denied"
        description={
          <Box display="flex" alignItems="center" gridGap={8}>
            <WarningIcon />
            <Typography>
              You do not have permission to view workflows of this component
            </Typography>
          </Box>
        }
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
        onTabChange={tab => setRunDetailsTab(tab)}
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
              {commitParamPath && (
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
              )}
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
