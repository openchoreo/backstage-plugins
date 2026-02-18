import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Content,
  Progress,
  InfoCard,
  StructuredMetadataTable,
  HeaderTabs,
} from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, IconButton, Typography, Paper } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useWorkflowRunDetails } from '../../hooks/useWorkflowRunDetails';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import { WorkflowRunLogs } from '../WorkflowRunLogs';
import { WorkflowRunEvents } from '../WorkflowRunEvents';

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
  tabContent: {
    marginTop: theme.spacing(2),
  },
  parametersContainer: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    maxHeight: 400,
  },
  parametersCode: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  pollingIndicator: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    fontStyle: 'italic',
  },
  section: {
    marginTop: theme.spacing(3),
  },
}));

// Helper to format date
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

export const WorkflowRunDetailsPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { runName } = useParams<{ runName: string }>();
  const decodedRunName = runName ? decodeURIComponent(runName) : '';
  const [activeTab, setActiveTab] = useState(0);

  const { run, loading, error, refetch } =
    useWorkflowRunDetails(decodedRunName);

  const runStatus = run?.phase || run?.status;
  const normalizedStatus = runStatus?.toLowerCase();
  const isActive =
    normalizedStatus === 'pending' || normalizedStatus === 'running';

  const handleBack = () => {
    navigate(-1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const tabs = [
    { id: 'logs', label: 'Logs' },
    { id: 'events', label: 'Events' },
    { id: 'details', label: 'Details' },
  ];

  if (loading && !run) {
    return (
      <Content>
        <Progress />
      </Content>
    );
  }

  if (error) {
    return (
      <Content>
        <Box className={classes.header}>
          <IconButton size="small" onClick={handleBack} title="Back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Workflow Run</Typography>
        </Box>
        <Alert severity="error">
          <AlertTitle>Error loading workflow run</AlertTitle>
          {error.message}
        </Alert>
      </Content>
    );
  }

  if (!run) {
    return (
      <Content>
        <Box className={classes.header}>
          <IconButton size="small" onClick={handleBack} title="Back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Workflow Run</Typography>
        </Box>
        <Alert severity="warning">
          <AlertTitle>Workflow run not found</AlertTitle>
          The workflow run "{decodedRunName}" could not be found.
        </Alert>
      </Content>
    );
  }

  const displayStatus = run.phase || run.status;

  const metadata = {
    Name: run.name,
    Status: <WorkflowRunStatusChip status={displayStatus} />,
    Workflow: run.workflowName,
    Namespace: run.namespaceName,
    Created: formatDate(run.createdAt),
    Finished: formatDate(run.finishedAt),
    UUID: run.uuid || '-',
  };

  return (
    <Content>
      <Box className={classes.header}>
        <IconButton size="small" onClick={handleBack} title="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" className={classes.title}>
          {run.name}
        </Typography>
        <WorkflowRunStatusChip status={displayStatus} />
        {isActive && (
          <Typography className={classes.pollingIndicator}>
            (auto-refreshing)
          </Typography>
        )}
        <IconButton onClick={handleRefresh} size="small" title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      <HeaderTabs
        tabs={tabs}
        selectedIndex={activeTab}
        onChange={setActiveTab}
      />

      <Box className={classes.tabContent}>
        {activeTab === 0 && <WorkflowRunLogs runName={decodedRunName} />}

        {activeTab === 1 && <WorkflowRunEvents runName={decodedRunName} />}

        {activeTab === 2 && (
          <>
            <InfoCard title="Run Details">
              <StructuredMetadataTable metadata={metadata} />
            </InfoCard>

            {run.parameters && Object.keys(run.parameters).length > 0 && (
              <Box className={classes.section}>
                <InfoCard title="Parameters">
                  <Paper
                    className={classes.parametersContainer}
                    variant="outlined"
                  >
                    <pre className={classes.parametersCode}>
                      {JSON.stringify(run.parameters, null, 2)}
                    </pre>
                  </Paper>
                </InfoCard>
              </Box>
            )}
          </>
        )}
      </Box>
    </Content>
  );
};
