import { useEffect, useState, useCallback } from 'react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
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
  Paper,
  IconButton,
  CircularProgress,
  Chip,
  Collapse,
} from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { BuildLogs } from './BuildLogs';
import { WorkflowDetailsRenderer } from './WorkflowDetailsRenderer';
import { useWorkflowStyles } from './styles';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '../../utils/timeUtils';

const BuildStatusComponent = ({ status }: { status?: string }) => {
  const classes = useWorkflowStyles();
  const statusType = status?.toLowerCase();

  switch (statusType) {
    case 'completed':
      return (
        <Chip
          icon={<CheckCircleIcon style={{ color: '#2e7d32' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.successChip}`}
        />
      );
    case 'failed':
      return (
        <Chip
          icon={<ErrorIcon style={{ color: '#c62828' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.errorChip}`}
        />
      );
    case 'running':
      return (
        <Chip
          icon={<CircularProgress size={14} style={{ color: '#01579b' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.runningChip}`}
        />
      );
    case 'pending':
      return (
        <Chip
          icon={<ScheduleIcon style={{ color: '#e65100' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.pendingChip}`}
        />
      );
    default:
      return (
        <Chip
          icon={<ScheduleIcon style={{ color: '#e65100' }} />}
          label={status || 'Unknown'}
          size="small"
          className={`${classes.statusChip} ${classes.pendingChip}`}
        />
      );
  }
};

export const Workflows = () => {
  const classes = useWorkflowStyles();
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);
  const [componentDetails, setComponentDetails] =
    useState<ModelsCompleteComponent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<ModelsBuild | null>(null);
  const [workflowDetailsExpanded, setWorkflowDetailsExpanded] = useState(true);

  const getEntityDetails = useCallback(async () => {
    if (!entity.metadata.name) {
      throw new Error('Component name not found');
    }

    const componentName = entity.metadata.name;

    // Get project name from spec.system
    const systemValue = entity.spec?.system;
    if (!systemValue) {
      throw new Error('Project name not found in spec.system');
    }

    // Convert system value to string (it could be string or object)
    const projectName =
      typeof systemValue === 'string' ? systemValue : String(systemValue);

    // Fetch the project entity to get the organization
    const projectEntityRef = `system:default/${projectName}`;
    const projectEntity = await catalogApi.getEntityByRef(projectEntityRef);

    if (!projectEntity) {
      throw new Error(`Project entity not found: ${projectEntityRef}`);
    }

    // Get organization from the project entity's spec.domain or annotations
    let organizationValue = projectEntity.spec?.domain;
    if (!organizationValue) {
      organizationValue =
        projectEntity.metadata.annotations?.['openchoreo.io/organization'];
    }

    if (!organizationValue) {
      throw new Error(
        `Organization name not found in project entity: ${projectEntityRef}`,
      );
    }

    // Convert organization value to string (it could be string or object)
    const organizationName =
      typeof organizationValue === 'string'
        ? organizationValue
        : String(organizationValue);

    return { componentName, projectName, organizationName };
  }, [entity, catalogApi]);

  const fetchComponentDetails = useCallback(async () => {
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      // Get authentication token
      const { token } = await identityApi.getCredentials();

      // Fetch component details
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const componentResponse = await fetch(
        `${baseUrl}/component?componentName=${encodeURIComponent(
          componentName,
        )}&projectName=${encodeURIComponent(
          projectName,
        )}&organizationName=${encodeURIComponent(organizationName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!componentResponse.ok) {
        throw new Error(
          `HTTP ${componentResponse.status}: ${componentResponse.statusText}`,
        );
      }

      const componentData = await componentResponse.json();
      setComponentDetails(componentData);
    } catch (err) {
      setError(err as Error);
    }
  }, [discoveryApi, identityApi, getEntityDetails]);

  const fetchBuilds = useCallback(async () => {
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      // Get authentication token
      const { token } = await identityApi.getCredentials();

      // Now fetch the builds
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const response = await fetch(
        `${baseUrl}/builds?componentName=${encodeURIComponent(
          componentName,
        )}&projectName=${encodeURIComponent(
          projectName,
        )}&organizationName=${encodeURIComponent(organizationName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buildsData = await response.json();
      setBuilds(buildsData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, identityApi, getEntityDetails]);

  const triggerWorkflow = async () => {
    setTriggeringWorkflow(true);
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      // Get authentication token
      const { token } = await identityApi.getCredentials();

      // Trigger the build (same as Build Latest functionality)
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

      // Refresh the builds list
      await fetchBuilds();
    } catch (err) {
      setError(err as Error);
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const refreshBuilds = async () => {
    setRefreshing(true);
    try {
      await fetchBuilds();
    } catch (err) {
      setError(err as Error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const fetchData = async () => {
      await Promise.all([fetchComponentDetails(), fetchBuilds()]);
    };
    if (!ignore) fetchData();

    return () => {
      ignore = true;
    };
  }, [
    entity,
    discoveryApi,
    catalogApi,
    identityApi,
    fetchComponentDetails,
    fetchBuilds,
  ]);

  // Poll builds every 5 seconds if any build is in pending/running state
  useEffect(() => {
    const hasActiveBuilds = builds.some(build => {
      const status = build.status?.toLowerCase() || '';
      return (
        status.includes('pending') ||
        status.includes('running') ||
        status.includes('progress')
      );
    });

    if (!hasActiveBuilds) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      fetchBuilds();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [builds, fetchBuilds]);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
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
        <BuildStatusComponent status={(row as ModelsBuild).status} />
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

  return (
    <Box>
      {componentDetails && (
        <Paper className={classes.workflowCard}>
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
                onClick={() => setWorkflowDetailsExpanded(!workflowDetailsExpanded)}
                title={workflowDetailsExpanded ? 'Collapse' : 'Expand'}
              >
                {workflowDetailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={triggerWorkflow}
              disabled={triggeringWorkflow || !componentDetails.workflow}
              startIcon={triggeringWorkflow ? <CircularProgress size={16} /> : undefined}
            >
              Trigger Workflow
            </Button>
          </Box>

          <Collapse in={workflowDetailsExpanded}>
            {componentDetails.workflow ? (
              <Box
                paddingTop={2}
                marginTop={2}
                borderTop="1px solid"
                borderColor="divider"
              >
                <Box className={classes.propertyRow} style={{ marginBottom: '16px' }}>
                  <Typography className={classes.propertyKey}>
                    Workflow Name:
                  </Typography>
                  <Typography className={classes.propertyValue}>
                    {componentDetails.workflow.name}
                  </Typography>
                </Box>
                {componentDetails.workflow.schema &&
                  Object.keys(componentDetails.workflow.schema).length > 0 && (
                    <WorkflowDetailsRenderer data={componentDetails.workflow.schema} />
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
        </Paper>
      )}
      <Table
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h4" component="span">
              Workflow Runs
            </Typography>
            <IconButton
              size="small"
              onClick={refreshBuilds}
              disabled={refreshing || loading}
              style={{ marginLeft: '8px' }}
              title={refreshing ? 'Refreshing...' : 'Refresh builds'}
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
          setSelectedBuild(rowData as ModelsBuild);
          setDrawerOpen(true);
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        build={selectedBuild}
      />
    </Box>
  );
};
