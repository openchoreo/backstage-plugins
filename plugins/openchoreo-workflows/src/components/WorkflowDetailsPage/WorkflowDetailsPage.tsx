import { useParams, useNavigate } from 'react-router-dom';
import {
  Content,
  Progress,
  Table,
  TableColumn,
  Link,
} from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, Button, IconButton, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { useWorkflows } from '../../hooks/useWorkflows';
import { useWorkflowRuns } from '../../hooks/useWorkflowRuns';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import type { WorkflowRun } from '../../types';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
  },
  title: {
    flexGrow: 1,
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
  },
  runsHeader: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Helper to calculate duration
function calculateDuration(createdAt: string, finishedAt?: string): string {
  if (!finishedAt) return '-';

  const start = new Date(createdAt).getTime();
  const end = new Date(finishedAt).getTime();
  const diffMs = end - start;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export const WorkflowDetailsPage = () => {
  const classes = useStyles();
  const { workflowName } = useParams<{ workflowName: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(workflowName || '');

  const { workflows, loading: workflowsLoading } = useWorkflows();
  const {
    runs,
    loading: runsLoading,
    error,
    refetch,
  } = useWorkflowRuns(decodedName);

  const workflow = workflows.find(w => w.name === decodedName);

  const columns: TableColumn<WorkflowRun>[] = [
    {
      title: 'Run Name',
      field: 'name',
      render: (row: WorkflowRun) => (
        <Link to={`../runs/${encodeURIComponent(row.name)}`}>{row.name}</Link>
      ),
    },
    {
      title: 'Status',
      field: 'status',
      render: (row: WorkflowRun) => (
        <WorkflowRunStatusChip status={row.phase || row.status} />
      ),
    },
    {
      title: 'Created',
      field: 'createdAt',
      render: (row: WorkflowRun) => formatRelativeTime(row.createdAt),
    },
    {
      title: 'Duration',
      render: (row: WorkflowRun) =>
        calculateDuration(row.createdAt, row.finishedAt),
    },
  ];

  if (workflowsLoading) {
    return (
      <Content>
        <Progress />
      </Content>
    );
  }

  return (
    <Content>
      <Box className={classes.header}>
        <IconButton onClick={() => navigate('..')} size="small" title="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" className={classes.title}>
          {workflow?.displayName || decodedName}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PlayArrowIcon />}
          onClick={() => navigate('trigger')}
        >
          Run Workflow
        </Button>
      </Box>

      {workflow?.description && (
        <Typography variant="body1" className={classes.description}>
          {workflow.description}
        </Typography>
      )}

      <Box className={classes.runsHeader}>
        <Typography variant="h6">Workflow Runs</Typography>
        <IconButton onClick={() => refetch()} size="small" title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error">
          <AlertTitle>Error loading runs</AlertTitle>
          {error.message}
        </Alert>
      )}

      {runsLoading && <Progress />}

      {!runsLoading && runs.length === 0 && (
        <Box className={classes.emptyState}>
          <Typography variant="h6">No runs yet</Typography>
          <Typography variant="body2">
            Click "Run Workflow" to execute this workflow.
          </Typography>
        </Box>
      )}

      {!runsLoading && runs.length > 0 && (
        <Table
          data={runs}
          columns={columns}
          options={{
            search: true,
            paging: true,
            pageSize: 10,
            sorting: true,
          }}
          onRowClick={(_, row) => {
            if (row) {
              navigate(`../runs/${encodeURIComponent(row.name)}`);
            }
          }}
        />
      )}
    </Content>
  );
};
