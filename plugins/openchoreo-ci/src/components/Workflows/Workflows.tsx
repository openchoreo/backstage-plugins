import { useState, useCallback, useEffect, useMemo } from 'react';
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
import { Typography, Button, Box, CircularProgress } from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import SettingsIcon from '@material-ui/icons/SettingsOutlined';
import ListAltOutlinedIcon from '@material-ui/icons/ListAltOutlined';
import EditIcon from '@material-ui/icons/Edit';
import {
  VerticalTabNav,
  TabItemData,
  SplitButton,
} from '@openchoreo/backstage-design-system';
import type { SplitButtonOption } from '@openchoreo/backstage-design-system';
import { WorkflowConfigPage } from '../WorkflowConfigPage';
import { WorkflowRunDetailsPage } from '../WorkflowRunDetailsPage';
import { RunsTab } from '../RunsTab';
import { OverviewTab } from '../OverviewTab';
import { BuildWithParamsDialog } from '../BuildWithParamsDialog';
import {
  useWorkflowData,
  useWorkflowRouting,
  useWorkflowRetention,
} from '../../hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import {
  CHOREO_LABELS,
  CHOREO_ANNOTATIONS,
  filterEmptyObjectProperties,
} from '@openchoreo/backstage-plugin-common';
import {
  useComponentEntityDetails,
  useBuildPermission,
  useAsyncOperation,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import { walkSchemaForGitFields } from '../../utils/schemaExtensions';
import type { GitFieldMapping } from '../../utils/schemaExtensions';
import { useStyles } from './styles';

/**
 * Unwrap the "parameters" wrapper from the API schema.
 */
function unwrapParametersSchema(schema: any): any {
  const innerParams = schema?.properties?.parameters;
  if (
    innerParams &&
    typeof innerParams === 'object' &&
    innerParams.properties
  ) {
    return {
      ...schema,
      ...innerParams,
      properties: innerParams.properties,
    };
  }
  return schema;
}

export const Workflows = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { entity } = useEntity();
  const client = useApi(openChoreoCiClientApiRef);
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

  // Git field mapping detected from workflow schema extensions
  const [gitFieldMapping, setGitFieldMapping] = useState<GitFieldMapping>({});

  // Data fetching hook
  const workflowData = useWorkflowData();

  // Check if component has workflow from componentDetails
  const hasWorkflow = !!workflowData.componentDetails?.componentWorkflow;

  // Fetch workflow schema and detect git field mapping from extensions
  const workflowName = workflowData.componentDetails?.componentWorkflow?.name;
  const workflowKind = workflowData.componentDetails?.componentWorkflow?.kind;
  const entityNamespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  // Fetch workflow retention TTL from catalog entity
  const retentionTtl = useWorkflowRetention(
    workflowName,
    workflowKind,
    entityNamespace,
  );
  useEffect(() => {
    let ignore = false;

    const detectGitFields = async () => {
      if (!workflowName) {
        setGitFieldMapping({});
        return;
      }

      try {
        const namespace =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
        if (!namespace) {
          setGitFieldMapping({});
          return;
        }

        const schemaResponse = await client.fetchWorkflowSchema(
          namespace,
          workflowName,
          workflowKind,
        );

        if (ignore) return;

        const rawSchema = (
          schemaResponse.success !== undefined && schemaResponse.data
            ? schemaResponse.data
            : schemaResponse
        ) as any;

        if (!rawSchema || typeof rawSchema !== 'object') {
          setGitFieldMapping({});
          return;
        }

        const cleaned = filterEmptyObjectProperties(rawSchema);
        const unwrapped = unwrapParametersSchema(cleaned);

        if (unwrapped?.properties) {
          setGitFieldMapping(walkSchemaForGitFields(unwrapped.properties, ''));
        } else {
          setGitFieldMapping({});
        }
      } catch {
        if (!ignore) {
          setGitFieldMapping({});
        }
      }
    };

    detectGitFields();
    return () => {
      ignore = true;
    };
  }, [workflowName, workflowKind, entity, client]);

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

  // Split button options for the build action
  const buildOptions = useMemo<SplitButtonOption[]>(
    () => [
      {
        key: 'build-latest',
        label: 'Build Latest',
        icon: <PlayArrowIcon />,
      },
      {
        key: 'build-custom',
        label: 'Build with Custom Parameters',
        icon: <PlayArrowIcon />,
      },
    ],
    [],
  );

  const handleBuildAction = useCallback(
    (key: string) => {
      if (key === 'build-latest') {
        triggerWorkflowOp.execute();
      } else if (key === 'build-custom') {
        handleOpenParamsDialog();
      }
    },
    [triggerWorkflowOp, handleOpenParamsDialog],
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
            gitFieldMapping={gitFieldMapping}
            retentionTtl={retentionTtl}
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
        gitFieldMapping={gitFieldMapping}
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
            <SplitButton
              options={buildOptions}
              onClick={handleBuildAction}
              disabled={buildDisabled}
              loading={triggerWorkflowOp.isLoading}
              loadingIcon={<CircularProgress size={16} />}
              tooltip={deniedTooltip}
            />
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
