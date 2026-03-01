import { useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  Content,
  Header,
  Page,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
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
  refreshButton: {
    marginLeft: theme.spacing(1),
  },
  headerRow: {
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

// Workflows Table
const WorkflowsTable = ({ workflows }: { workflows: Workflow[] }) => {
  const navigate = useNavigate();

  const columns: TableColumn<Workflow>[] = [
    {
      title: 'Name',
      field: 'name',
      highlight: true,
      render: (workflow: Workflow) => (
        <Typography variant="body2">
          {workflow.displayName || workflow.name}
        </Typography>
      ),
    },
    {
      title: 'Type',
      field: 'type',
      width: '15%',
      render: (workflow: Workflow) => (
        <Typography variant="body2">{workflow.type || '-'}</Typography>
      ),
    },
    {
      title: 'Description',
      field: 'description',
      render: (workflow: Workflow) => (
        <Typography variant="body2" noWrap title={workflow.description || ''}>
          {workflow.description || '-'}
        </Typography>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={workflows}
      options={{
        paging: true,
        pageSize: 10,
        pageSizeOptions: [10, 20, 50],
        search: true,
        padding: 'dense',
        draggable: false,
      }}
      onRowClick={(_e, workflow) => {
        if (workflow) navigate(encodeURIComponent(workflow.name));
      }}
    />
  );
};

// Workflows List Content
const WorkflowsListContent = () => {
  const classes = useStyles();
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

      {selectedNamespace && !workflowsLoading && (
        <>
          <Box className={classes.headerRow}>
            <Typography variant="h6">
              Workflow Templates
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
          <WorkflowsTable workflows={workflows} />
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
