import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../../api';
import { useSelectedNamespace } from '../../context';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import type {
  WorkflowRunStatusResponse,
  WorkflowStepStatus,
} from '../../types';

const useStyles = makeStyles(theme => ({
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  stepAccordion: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    '&:before': {
      display: 'none',
    },
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepTitle: {
    fontWeight: 500,
  },
  stepStatusChip: {
    marginLeft: theme.spacing(1),
  },
  logsContainer: {
    flex: 'auto',
    backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    minHeight: '300px',
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    padding: theme.spacing(2),
  },
  logText: {
    fontSize: '12px',
    color: theme.palette.text.primary,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.6',
    marginBottom: theme.spacing(0.5),
  },
  noLogsText: {
    fontSize: '12px',
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    gap: theme.spacing(1),
  },
  inlineLoadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
}));

interface WorkflowRunStepLogsProps {
  runName: string;
}

export const WorkflowRunStepLogs = ({ runName }: WorkflowRunStepLogsProps) => {
  const classes = useStyles();
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const [statusState, setStatusState] =
    useState<WorkflowRunStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeStepName, setActiveStepName] = useState<string | null>(null);
  const [logsByStep, setLogsByStep] = useState<Record<string, string[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const terminalStatuses = useMemo(
    () => ['completed', 'failed', 'succeeded', 'error'],
    [],
  );

  const isTerminalStatus = (status?: string) =>
    status ? terminalStatuses.includes(status.toLowerCase()) : false;

  // Fetch workflow run status with polling
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const fetchStatus = async () => {
      try {
        if (!cancelled) {
          setStatusLoading(true);
          setStatusError(null);
        }

        const data = await client.getWorkflowRunStatus(namespaceName, runName);

        if (cancelled) return;

        setStatusState(data);

        // Auto-select initial step if none selected yet
        if (data.steps && data.steps.length > 0) {
          setActiveStepName(prev => {
            if (prev) return prev;
            const runningStep = data.steps!.find(
              s => s.phase?.toLowerCase() === 'running',
            );
            const defaultStep =
              isTerminalStatus(data.status) || !runningStep
                ? data.steps![data.steps!.length - 1]
                : runningStep;
            return defaultStep?.name ?? null;
          });
        }

        if (isTerminalStatus(data.status) && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (err) {
        if (cancelled) return;
        setStatusError(
          err instanceof Error ? err.message : 'Failed to fetch run status',
        );
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };

    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 10_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, namespaceName, runName]);

  // Fetch logs for the active step
  useEffect(() => {
    if (!statusState?.steps || !activeStepName) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const activeStep: WorkflowStepStatus | undefined = statusState.steps.find(
      step => step.name === activeStepName,
    );
    const isRunningStep =
      activeStep?.phase?.toLowerCase() === 'running' &&
      !isTerminalStatus(statusState.status);

    const fetchLogs = async () => {
      try {
        if (!cancelled) {
          setLogsLoading(true);
          setLogsError(null);
        }

        const response = await client.getWorkflowRunLogs(
          namespaceName,
          runName,
          activeStepName ?? undefined,
        );

        if (cancelled) return;

        setLogsByStep(prev => ({
          ...prev,
          [activeStepName]: (response.logs ?? []).map(e => e.log),
        }));
      } catch (err) {
        if (cancelled) return;
        setLogsError(
          err instanceof Error ? err.message : 'Failed to fetch logs',
        );
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    };

    fetchLogs();

    if (isRunningStep) {
      intervalId = window.setInterval(fetchLogs, 10_000);
    }

    // eslint-disable-next-line consistent-return
    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    namespaceName,
    runName,
    activeStepName,
    statusState?.status,
    statusState?.steps,
  ]);

  const handleStepChange = (stepName: string) => {
    setActiveStepName(prev => (prev === stepName ? null : stepName));
  };

  if (statusLoading && !statusState) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="textSecondary">
          Loading workflow run status...
        </Typography>
      </Box>
    );
  }

  if (statusError) {
    return <Alert severity="error">{statusError}</Alert>;
  }

  if (!statusState || !statusState.steps || statusState.steps.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No steps available for this workflow run
      </Typography>
    );
  }

  const activeLogs: string[] =
    (activeStepName && logsByStep[activeStepName]) || [];

  return (
    <Box>
      <Box className={classes.stepsContainer}>
        {statusState.steps.map(step => (
          <Accordion
            key={step.name}
            expanded={activeStepName === step.name}
            onChange={() => handleStepChange(step.name)}
            className={classes.stepAccordion}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box className={classes.stepHeader}>
                <Typography
                  variant="body2"
                  className={classes.stepTitle}
                  color="textPrimary"
                >
                  {step.name}
                </Typography>
                <Box className={classes.stepStatusChip}>
                  <WorkflowRunStatusChip status={step.phase} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {activeStepName === step.name ? (
                <Box className={classes.logsContainer}>
                  {logsLoading && activeLogs.length === 0 && (
                    <Box className={classes.inlineLoadingContainer}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="textSecondary">
                        Loading logs...
                      </Typography>
                    </Box>
                  )}

                  {logsError && <Alert severity="error">{logsError}</Alert>}

                  {!logsLoading && !logsError && activeLogs.length === 0 && (
                    <Typography variant="body2" className={classes.noLogsText}>
                      No logs available for this step
                    </Typography>
                  )}

                  {activeLogs.map((line, index) => (
                    <Box key={index} style={{ marginBottom: '4px' }}>
                      <Typography variant="body2" className={classes.logText}>
                        {line}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" className={classes.noLogsText}>
                  Expand this step to view logs.
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};
