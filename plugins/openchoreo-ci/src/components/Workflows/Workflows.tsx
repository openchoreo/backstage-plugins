import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
} from '@backstage/core-components';
import {
  Typography,
  Button,
  ButtonGroup,
  Box,
  CircularProgress,
  Tooltip,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
} from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import SettingsIcon from '@material-ui/icons/SettingsOutlined';
import ListAltOutlinedIcon from '@material-ui/icons/ListAltOutlined';
import EditIcon from '@material-ui/icons/Edit';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { WorkflowConfigPage } from '../WorkflowConfigPage';
import { WorkflowRunDetailsPage } from '../WorkflowRunDetailsPage';
import { RunsTab } from '../RunsTab';
import { OverviewTab } from '../OverviewTab';
import { BuildWithParamsDialog } from '../BuildWithParamsDialog';
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
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useStyles } from './styles';

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
    viewPermissionName,
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
  const [isParamsDialogOpen, setIsParamsDialogOpen] = useState(false);

  // Split button menu state
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const splitButtonRef = useRef<HTMLDivElement>(null);

  // Full WORKFLOW_PARAMETERS annotation mapping
  const [parameterMapping, setParameterMapping] = useState<Record<
    string,
    string
  > | null>(null);

  // Data fetching hook
  const workflowData = useWorkflowData();

  // Check if component has workflow from componentDetails
  const hasWorkflow = !!workflowData.componentDetails?.componentWorkflow;

  // Fetch WORKFLOW_PARAMETERS annotation to get full mapping (git fields, etc.)
  const workflowName = workflowData.componentDetails?.componentWorkflow?.name;
  useEffect(() => {
    let ignore = false;

    const fetchParameterMapping = async () => {
      if (!workflowName) {
        setParameterMapping(null);
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
          setParameterMapping(parseWorkflowParametersAnnotation(annotation));
        } else {
          setParameterMapping(null);
        }
      } catch {
        if (!ignore) {
          setParameterMapping(null);
        }
      }
    };

    fetchParameterMapping();
    return () => {
      ignore = true;
    };
  }, [workflowName, catalogApi, getEntityDetails]);

  // Derive commitParamPath for RunsTab (commit column display)
  const commitParamPath = parameterMapping?.commit ?? null;

  // Find run by ID for run-details view
  const selectedRun = useMemo(() => {
    if (routingState.view !== 'run-details' || !routingState.runId) {
      return undefined;
    }
    return workflowData.builds.find(build => build.name === routingState.runId);
  }, [routingState.view, routingState.runId, workflowData.builds]);

  // Async operation for triggering workflow with default parameters
  const triggerWorkflowOp = useAsyncOperation(
    useCallback(async () => {
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();
      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-workflows-backend',
      );

      const workflow = workflowData.componentDetails?.componentWorkflow;
      if (!workflow?.name) {
        throw new Error('No workflow configured for this component');
      }

      const parameters = workflow.parameters
        ? JSON.parse(JSON.stringify(workflow.parameters))
        : {};

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
            workflowKind: workflow.kind ?? 'Workflow',
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
    }, [discoveryApi, fetchApi, getEntityDetails, workflowData]),
  );

  // Async operation for triggering workflow with custom parameters
  const triggerWithParamsOp = useAsyncOperation(
    useCallback(
      async (customParameters: Record<string, unknown>) => {
        const { componentName, projectName, namespaceName } =
          await getEntityDetails();
        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-workflows-backend',
        );

        const workflow = workflowData.componentDetails?.componentWorkflow;
        if (!workflow?.name) {
          throw new Error('No workflow configured for this component');
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
              workflowKind: workflow.kind ?? 'Workflow',
              workflowRunName: `${componentName}-${Date.now()}`,
              parameters: customParameters,
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

  const handleOpenParamsDialog = useCallback(() => {
    setSplitMenuOpen(false);
    setIsParamsDialogOpen(true);
  }, []);

  const handleCloseParamsDialog = useCallback(() => {
    setIsParamsDialogOpen(false);
  }, []);

  const handleTriggerWithParams = useCallback(
    async (parameters: Record<string, unknown>) => {
      await triggerWithParamsOp.execute(parameters);
    },
    [triggerWithParamsOp],
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
      <ForbiddenState
        message="You do not have permission to view workflows of this component."
        permissionName={viewPermissionName}
        variant="fullpage"
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
        workflowKind={workflowData.componentDetails.componentWorkflow.kind}
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
  const buildDisabled =
    triggerWorkflowOp.isLoading ||
    !componentDetails?.componentWorkflow ||
    permissionLoading ||
    !canBuild;

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h5" className={classes.headerTitle}>
          Workflows
        </Typography>
        <Box className={classes.headerActions}>
          {routingState.tab === 'runs' ? (
            <Tooltip title={deniedTooltip}>
              <span>
                <ButtonGroup
                  variant="contained"
                  color="primary"
                  ref={splitButtonRef}
                  disabled={buildDisabled}
                >
                  <Button
                    onClick={() => triggerWorkflowOp.execute()}
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
                  <Button
                    size="small"
                    onClick={() => setSplitMenuOpen(prev => !prev)}
                    className={classes.splitDropdown}
                  >
                    <ArrowDropDownIcon />
                  </Button>
                </ButtonGroup>
                <Popper
                  open={splitMenuOpen}
                  anchorEl={splitButtonRef.current}
                  role={undefined}
                  transition
                  disablePortal
                  style={{ zIndex: 1 }}
                >
                  {({ TransitionProps, placement }) => (
                    <Grow
                      {...TransitionProps}
                      style={{
                        transformOrigin:
                          placement === 'bottom'
                            ? 'center top'
                            : 'center bottom',
                      }}
                    >
                      <Paper>
                        <ClickAwayListener
                          onClickAway={() => setSplitMenuOpen(false)}
                        >
                          <MenuList>
                            <MenuItem onClick={handleOpenParamsDialog}>
                              Build with Custom Parameters
                            </MenuItem>
                          </MenuList>
                        </ClickAwayListener>
                      </Paper>
                    </Grow>
                  )}
                </Popper>
              </span>
            </Tooltip>
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

      <BuildWithParamsDialog
        open={isParamsDialogOpen}
        onClose={handleCloseParamsDialog}
        onTrigger={handleTriggerWithParams}
        isLoading={triggerWithParamsOp.isLoading}
        workflowName={componentDetails?.componentWorkflow?.name || ''}
        workflowKind={componentDetails?.componentWorkflow?.kind}
        currentParameters={
          componentDetails?.componentWorkflow?.parameters || null
        }
      />
    </Box>
  );
};
