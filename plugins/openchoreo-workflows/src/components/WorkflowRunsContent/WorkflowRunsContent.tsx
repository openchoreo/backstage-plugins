import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Content,
  Progress,
  Table,
  TableColumn,
  InfoCard,
  StructuredMetadataTable,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Alert, AlertTitle } from '@material-ui/lab';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Button,
  Collapse,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import CloseIcon from '@material-ui/icons/Close';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import EventNoteOutlinedIcon from '@material-ui/icons/EventNoteOutlined';
import Form from '@rjsf/material-ui';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { IChangeEvent } from '@rjsf/core';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  DetailPageLayout,
  formatRelativeTime,
} from '@openchoreo/backstage-plugin-react';
import { useWorkflowRuns } from '../../hooks/useWorkflowRuns';
import { useWorkflowRunDetails } from '../../hooks/useWorkflowRunDetails';
import { useWorkflowRunLogs } from '../../hooks/useWorkflowRunLogs';
import { useWorkflowSchema } from '../../hooks/useWorkflowSchema';
import { genericWorkflowsClientApiRef } from '../../api';
import { useSelectedNamespace } from '../../context';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import { WorkflowRunLogs } from '../WorkflowRunLogs';
import { WorkflowRunEvents } from '../WorkflowRunEvents';
import type { WorkflowRun } from '../../types';

type RunDetailsTab = 'logs' | 'events' | 'details';

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
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
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
  triggerSection: {
    marginBottom: theme.spacing(3),
  },
  triggerFormContainer: {
    marginTop: theme.spacing(2),
  },
  triggerActions: {
    marginTop: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(1),
  },
  noSchemaMessage: {
    padding: theme.spacing(2),
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

// Helper to format date
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

/**
 * Inline trigger form component shown within the runs page.
 */
const TriggerForm = ({
  workflowName,
  onTriggered,
  onCancel,
}: {
  workflowName: string;
  onTriggered: (runName: string) => void;
  onCancel: () => void;
}) => {
  const classes = useStyles();
  const namespaceName = useSelectedNamespace();
  const client = useApi(genericWorkflowsClientApiRef);
  const { schema, loading, error } = useWorkflowSchema(workflowName);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const handleSubmit = async (data: IChangeEvent) => {
    try {
      setSubmitting(true);
      setSubmitError(null);

      const run = await client.createWorkflowRun(
        namespaceName,
        workflowName,
        data.formData ?? {},
      );

      onTriggered(run.name);
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error loading workflow schema</AlertTitle>
        {error.message}
      </Alert>
    );
  }

  const hasSchema =
    schema &&
    typeof schema === 'object' &&
    'properties' in schema &&
    Object.keys((schema as any).properties || {}).length > 0;

  const uiSchema: UiSchema = {
    'ui:submitButtonOptions': {
      norender: true,
    },
  };

  return (
    <InfoCard
      title="Trigger Workflow"
      action={
        <IconButton
          size="small"
          onClick={onCancel}
          title="Close"
          aria-label="Close workflow trigger"
        >
          <CloseIcon />
        </IconButton>
      }
    >
      {submitError && (
        <Alert severity="error" style={{ marginBottom: 16 }}>
          <AlertTitle>Error triggering workflow</AlertTitle>
          {submitError.message}
        </Alert>
      )}

      {hasSchema ? (
        <Box className={classes.triggerFormContainer}>
          <Form
            schema={schema as RJSFSchema}
            uiSchema={uiSchema}
            formData={formData}
            validator={validator}
            onChange={e => setFormData(e.formData || {})}
            onSubmit={handleSubmit}
          >
            <Box className={classes.triggerActions}>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Triggering...' : 'Trigger Workflow'}
              </Button>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
            </Box>
          </Form>
        </Box>
      ) : (
        <Box>
          <Typography className={classes.noSchemaMessage}>
            This workflow has no configurable parameters.
          </Typography>
          <Box className={classes.triggerActions}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSubmit({ formData: {} } as IChangeEvent)}
              disabled={submitting}
            >
              {submitting ? 'Triggering...' : 'Trigger Workflow'}
            </Button>
            <Button variant="outlined" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </InfoCard>
  );
};

/**
 * Sub-component: displays details + logs + events for a single run.
 */
const RunDetailView = ({
  runName,
  onBack,
}: {
  runName: string;
  onBack: () => void;
}) => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState<RunDetailsTab>('logs');

  const { run, loading, error, refetch } = useWorkflowRunDetails(runName);

  const runStatus = run?.phase || run?.status;
  const normalizedStatus = runStatus?.toLowerCase();
  const isActive =
    normalizedStatus === 'pending' || normalizedStatus === 'running';

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useWorkflowRunLogs(runName, isActive);

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
    return <Progress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error loading workflow run</AlertTitle>
        {error.message}
      </Alert>
    );
  }

  if (!run) {
    return (
      <Alert severity="warning">
        <AlertTitle>Workflow run not found</AlertTitle>
        The workflow run "{runName}" could not be found.
      </Alert>
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
        {formatRelativeTime(run.createdAt || '')}
      </Typography>
    </>
  );

  const actions = (
    <IconButton
      onClick={handleRefresh}
      size="small"
      title="Refresh"
      aria-label="Refresh"
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
        return <WorkflowRunEvents runName={runName} />;
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
    <DetailPageLayout
      title={run.name}
      subtitle={subtitle}
      onBack={onBack}
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
  );
};

/**
 * Entity-aware workflow runs content component.
 * Must be used within a NamespaceProvider.
 * Gets workflowName from the entity's metadata.name.
 * Shows a list of runs with the ability to trigger new runs and drill into run details/logs.
 */
export const WorkflowRunsContent = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTriggerForm, setShowTriggerForm] = useState(false);

  const workflowName = entity.metadata.name;
  const selectedRunName = searchParams.get('run');

  const {
    runs,
    loading: runsLoading,
    error,
    refetch,
  } = useWorkflowRuns(workflowName);

  const handleRunClick = (runName: string) => {
    setSearchParams({ run: runName });
  };

  const handleBackToList = () => {
    setSearchParams({});
  };

  const handleTriggered = (runName: string) => {
    setShowTriggerForm(false);
    refetch();
    // Navigate to the newly triggered run
    setSearchParams({ run: runName });
  };

  // If a run is selected, show its details
  if (selectedRunName) {
    return (
      <Content>
        <RunDetailView runName={selectedRunName} onBack={handleBackToList} />
      </Content>
    );
  }

  // Otherwise show the runs list
  const columns: TableColumn<WorkflowRun>[] = [
    {
      title: 'Run Name',
      field: 'name',
      render: (row: WorkflowRun) => (
        <Button
          color="primary"
          style={{ textTransform: 'none' }}
          onClick={e => {
            e.stopPropagation();
            handleRunClick(row.name);
          }}
        >
          {row.name}
        </Button>
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
      defaultSort: 'desc',
      render: (row: WorkflowRun) => formatRelativeTime(row.createdAt),
    },
    {
      title: 'Duration',
      render: (row: WorkflowRun) =>
        calculateDuration(row.createdAt, row.finishedAt),
    },
  ];

  return (
    <Content>
      <Box className={classes.header}>
        <Typography variant="h6" className={classes.title}>
          Workflow Runs
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={() => setShowTriggerForm(prev => !prev)}
        >
          Trigger
        </Button>
        <IconButton
          onClick={() => refetch()}
          size="small"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      <Collapse in={showTriggerForm}>
        <Box className={classes.triggerSection}>
          <TriggerForm
            workflowName={workflowName}
            onTriggered={handleTriggered}
            onCancel={() => setShowTriggerForm(false)}
          />
        </Box>
      </Collapse>

      {error && (
        <Alert severity="error">
          <AlertTitle>Error loading runs</AlertTitle>
          {error.message}
        </Alert>
      )}

      {runsLoading && <Progress />}

      {!runsLoading && runs.length === 0 && !showTriggerForm && (
        <Box className={classes.emptyState}>
          <Typography variant="h6">No runs yet</Typography>
          <Typography variant="body2">
            Click the "Trigger" button above to execute this workflow.
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
              handleRunClick(row.name);
            }
          }}
        />
      )}
    </Content>
  );
};
