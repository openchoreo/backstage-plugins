import { useState, useCallback } from 'react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  Typography,
  Button,
  Box,
  IconButton,
  CircularProgress,
  Collapse,
} from '@material-ui/core';
import { Card } from '@openchoreo/backstage-design-system';
import Refresh from '@material-ui/icons/Refresh';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { BuildLogs } from './BuildLogs';
import { BuildStatusChip } from './BuildStatusChip';
import { WorkflowDetailsRenderer } from './WorkflowDetailsRenderer';
import { EditWorkflowDialog } from './EditWorkflowConfigs';
import { useWorkflowStyles } from './styles';
import { useWorkflowData } from './hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import {
  formatRelativeTime,
  useComponentEntityDetails,
} from '@openchoreo/backstage-plugin-react';
import { useDialogWithSelection, useAsyncOperation } from '../../hooks';

export const Workflows = () => {
  const classes = useWorkflowStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  // Data fetching hook (replaces builds, componentDetails, loading, error state + fetch callbacks + polling)
  const workflowData = useWorkflowData();

  // UI state
  const [workflowDetailsExpanded, setWorkflowDetailsExpanded] = useState(true);
  const [editWorkflowDialogOpen, setEditWorkflowDialogOpen] = useState(false);

  // Build logs drawer with selection
  const buildLogsDrawer = useDialogWithSelection<ModelsBuild>();

  // Async operations for trigger and refresh
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

  if (workflowData.loading) {
    return <Progress />;
  }

  if (workflowData.error) {
    return <ResponseErrorPanel error={workflowData.error} />;
  }

  const columns: TableColumn[] = [
    {
      title: 'Workflow Run Name',
      field: 'name',
      highlight: true,
    },
    {
      title: 'Status',
      field: 'status',
      render: (row: any) => (
        <BuildStatusChip status={(row as ModelsBuild).status} />
      ),
    },
    {
      title: 'Commit',
      field: 'commit',
      render: (row: any) => {
        const build = row as ModelsBuild;
        return build.commit ? (
          <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
            {build.commit.substring(0, 8)}
          </Typography>
        ) : (
          'N/A'
        );
      },
    },
    {
      title: 'Time',
      field: 'time',
      render: (row: any) =>
        formatRelativeTime((row as ModelsBuild).createdAt || ''),
    },
  ];

  const { componentDetails, builds } = workflowData;

  return (
    <Box>
      {componentDetails && (
        <Card padding={16} style={{ marginBottom: 16 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gridGap={1}>
              <Typography variant="h5" className={classes.headerTitle}>
                Workflow Details
              </Typography>
              <IconButton
                size="small"
                onClick={() =>
                  setWorkflowDetailsExpanded(!workflowDetailsExpanded)
                }
                title={workflowDetailsExpanded ? 'Collapse' : 'Expand'}
              >
                {workflowDetailsExpanded ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
            </Box>
            <Box display="flex" gridGap={8}>
              {componentDetails.workflow && (
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => setEditWorkflowDialogOpen(true)}
                  startIcon={<EditOutlinedIcon />}
                >
                  Edit Workflow
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={() => triggerWorkflowOp.execute()}
                disabled={
                  triggerWorkflowOp.isLoading || !componentDetails.workflow
                }
                startIcon={
                  triggerWorkflowOp.isLoading ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                Trigger Workflow
              </Button>
            </Box>
          </Box>

          <Collapse in={workflowDetailsExpanded}>
            {componentDetails.workflow ? (
              <Box
                paddingTop={2}
                marginTop={2}
                borderTop="1px solid"
                borderColor="divider"
              >
                <Box
                  className={classes.propertyRow}
                  style={{ marginBottom: '16px' }}
                >
                  <Typography className={classes.propertyKey}>
                    Workflow Name:
                  </Typography>
                  <Typography className={classes.propertyValue}>
                    {componentDetails.workflow.name}
                  </Typography>
                </Box>
                {componentDetails.workflow.schema &&
                  Object.keys(componentDetails.workflow.schema).length > 0 && (
                    <WorkflowDetailsRenderer
                      data={componentDetails.workflow.schema}
                    />
                  )}
              </Box>
            ) : (
              <Box
                className={classes.emptyStateCard}
                paddingTop={2}
                marginTop={2}
                borderTop="1px solid"
                borderColor="divider"
              >
                <Typography variant="body1" color="textSecondary">
                  No workflow details available for this component.
                </Typography>
              </Box>
            )}
          </Collapse>
        </Card>
      )}
      <Table
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h4" component="span">
              Workflow Runs
            </Typography>
            <IconButton
              size="small"
              onClick={() => refreshOp.execute()}
              disabled={refreshOp.isLoading || workflowData.loading}
              style={{ marginLeft: '8px' }}
              title={refreshOp.isLoading ? 'Refreshing...' : 'Refresh builds'}
            >
              <Refresh style={{ fontSize: '18px' }} />
            </IconButton>
          </Box>
        }
        options={{
          search: true,
          paging: true,
          sorting: true,
        }}
        columns={columns}
        data={builds.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )}
        onRowClick={(_, rowData) => {
          buildLogsDrawer.open(rowData as ModelsBuild);
        }}
        emptyContent={
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
            padding={4}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No workflow runs found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Trigger a workflow to see runs appear here
            </Typography>
          </Box>
        }
      />
      <BuildLogs
        open={buildLogsDrawer.isOpen}
        onClose={buildLogsDrawer.close}
        build={buildLogsDrawer.selected}
      />
      {componentDetails?.workflow && (
        <EditWorkflowDialog
          open={editWorkflowDialogOpen}
          onClose={() => setEditWorkflowDialogOpen(false)}
          workflowName={componentDetails.workflow.name || ''}
          currentWorkflowSchema={componentDetails.workflow.schema || null}
          onSaved={() => {
            workflowData.fetchComponentDetails();
          }}
        />
      )}
    </Box>
  );
};
