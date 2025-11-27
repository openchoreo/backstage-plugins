import { useState, useCallback, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { Typography, Button, Box, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import ListAltOutlinedIcon from '@material-ui/icons/ListAltOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { WorkflowConfigPage } from './WorkflowConfigPage';
import { WorkflowRunDetailsPage } from './WorkflowRunDetailsPage';
import { RunsTab, OverviewTab } from './components';
import { useWorkflowData } from './hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { useComponentEntityDetails } from '@openchoreo/backstage-plugin-react';
import { useAsyncOperation } from '../../hooks';
import type { WorkflowViewMode } from './types';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
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
}));

export const Workflows = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  // View mode state
  const [viewMode, setViewMode] = useState<WorkflowViewMode>({ type: 'list' });
  const [activeTab, setActiveTab] = useState('runs');

  // Data fetching hook
  const workflowData = useWorkflowData();

  // Async operation for triggering workflow
  const triggerWorkflowOp = useAsyncOperation(
    useCallback(async () => {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();
      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      const response = await fetch(`${baseUrl}/builds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          componentName,
          projectName,
          organizationName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await workflowData.fetchBuilds();
    }, [discoveryApi, identityApi, getEntityDetails, workflowData]),
  );

  const refreshOp = useAsyncOperation(workflowData.fetchBuilds);

  // Navigation handlers
  const handleBack = useCallback(() => {
    setViewMode({ type: 'list' });
  }, []);

  const handleOpenConfig = useCallback(() => {
    setViewMode({ type: 'config' });
  }, []);

  const handleOpenRunDetails = useCallback((run: ModelsBuild) => {
    setViewMode({ type: 'run-details', run });
  }, []);

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
        id: 'overview',
        label: 'Overview',
        icon: <InfoOutlinedIcon fontSize="small" />,
      },
    ],
    [workflowData.builds.length],
  );

  const renderTabContent = () => {
    switch (activeTab) {
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
      case 'overview':
        return (
          <OverviewTab workflow={workflowData.componentDetails?.workflow} />
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

  // Config page view
  if (viewMode.type === 'config' && workflowData.componentDetails?.workflow) {
    return (
      <WorkflowConfigPage
        workflowName={workflowData.componentDetails.workflow.name || ''}
        currentWorkflowSchema={
          workflowData.componentDetails.workflow.schema || null
        }
        onBack={handleBack}
        onSaved={() => {
          workflowData.fetchComponentDetails();
        }}
      />
    );
  }

  // Run details page view
  if (viewMode.type === 'run-details') {
    return <WorkflowRunDetailsPage run={viewMode.run} onBack={handleBack} />;
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
          {componentDetails?.workflow && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handleOpenConfig}
              startIcon={<SettingsOutlinedIcon />}
            >
              Configure Workflow
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={() => triggerWorkflowOp.execute()}
            disabled={
              triggerWorkflowOp.isLoading || !componentDetails?.workflow
            }
            startIcon={
              triggerWorkflowOp.isLoading ? (
                <CircularProgress size={16} />
              ) : (
                <PlayArrowIcon />
              )
            }
          >
            Trigger Workflow
          </Button>
        </Box>
      </Box>

      <VerticalTabNav
        tabs={tabs}
        activeTabId={activeTab}
        onChange={setActiveTab}
      >
        {renderTabContent()}
      </VerticalTabNav>
    </Box>
  );
};
