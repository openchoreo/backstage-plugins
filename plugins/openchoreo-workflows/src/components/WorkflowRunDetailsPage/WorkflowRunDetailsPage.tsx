import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Content,
  Progress,
  InfoCard,
  StructuredMetadataTable,
} from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, IconButton, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import EventNoteOutlinedIcon from '@material-ui/icons/EventNoteOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  DetailPageLayout,
  formatRelativeTime,
} from '@openchoreo/backstage-plugin-react';
import { useWorkflowRunDetails } from '../../hooks/useWorkflowRunDetails';
import { useWorkflowRunLogs } from '../../hooks/useWorkflowRunLogs';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import { WorkflowRunLogs } from '../WorkflowRunLogs';
import { WorkflowRunEvents } from '../WorkflowRunEvents';

type RunDetailsTab = 'logs' | 'events' | 'details';

const useStyles = makeStyles(theme => ({
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
  const [activeTab, setActiveTab] = useState<RunDetailsTab>('logs');

  const { run, loading, error, refetch } =
    useWorkflowRunDetails(decodedRunName);

  const runStatus = run?.phase || run?.status;
  const normalizedStatus = runStatus?.toLowerCase();
  const isActive =
    normalizedStatus === 'pending' || normalizedStatus === 'running';

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useWorkflowRunLogs(decodedRunName, isActive);

  const handleBack = () => {
    navigate(-1);
  };

  const handleRefresh = () => {
    refetch();
    refetchLogs();
  };

  const tabs = useMemo<TabItemData[]>(
    () => [
      {
        id: 'logs',
        label: 'Logs',
        icon: <DescriptionOutlinedIcon fontSize="small" />,
      },
      {
        id: 'events',
        label: 'Events',
        icon: <EventNoteOutlinedIcon fontSize="small" />,
      },
      {
        id: 'details',
        label: 'Details',
        icon: <InfoOutlinedIcon fontSize="small" />,
      },
    ],
    [],
  );

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

  const subtitle = (
    <>
      <WorkflowRunStatusChip status={displayStatus} />
      <Typography variant="body2" color="textSecondary">
        {run.createdAt ? formatRelativeTime(run.createdAt) : '-'}
      </Typography>
    </>
  );

  const actions = (
    <IconButton
      onClick={handleRefresh}
      size="small"
      aria-label="Refresh workflow run"
    >
      <RefreshIcon />
    </IconButton>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'logs':
        return (
          <WorkflowRunLogs
            logs={logs}
            loading={logsLoading}
            error={logsError}
          />
        );
      case 'events':
        return <WorkflowRunEvents runName={decodedRunName} />;
      case 'details':
        return (
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
        );
      default:
        return null;
    }
  };

  return (
    <Content>
      <DetailPageLayout
        title={run.name}
        subtitle={subtitle}
        onBack={handleBack}
        actions={actions}
      >
        <VerticalTabNav
          tabs={tabs}
          activeTabId={activeTab}
          onChange={tabId => setActiveTab(tabId as RunDetailsTab)}
        >
          {renderTabContent()}
        </VerticalTabNav>
      </DetailPageLayout>
    </Content>
  );
};
