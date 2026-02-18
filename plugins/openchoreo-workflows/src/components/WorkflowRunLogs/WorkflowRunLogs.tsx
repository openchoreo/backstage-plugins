import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { Alert } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { genericWorkflowsClientApiRef } from '../../api';
import { useSelectedNamespace } from '../../context';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import { useStyles } from './styles';
import {
  useWorkflowRunStatus,
  isTerminalStatus,
} from '../../hooks/useWorkflowRunStatus';
import type { LogEntry, WorkflowStepStatus } from '../../types';

interface WorkflowRunLogsProps {
  runName: string;
}

function deduplicateLogs(logs: LogEntry[]): LogEntry[] {
  const seen = new Set<string>();
  return logs.filter(entry => {
    const key = `${entry.timestamp ?? ''}-${entry.log}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const WorkflowRunLogs = ({ runName }: WorkflowRunLogsProps) => {
  const classes = useStyles();
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const {
    statusState,
    statusLoading,
    statusError,
    isObservabilityNotConfigured: isStatusObsNotConfigured,
    activeStepName,
    setActiveStepName,
  } = useWorkflowRunStatus(
    runName,
    'Observability is not configured for this workflow run. Logs cannot be retrieved.',
  );

  const [logsByStep, setLogsByStep] = useState<Record<string, LogEntry[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isLogsObsNotConfigured, setIsLogsObsNotConfigured] = useState(false);

  // Reset log state when the viewed run or namespace changes
  useEffect(() => {
    setLogsByStep({});
    setLogsError(null);
    setIsLogsObsNotConfigured(false);
    setLogsLoading(false);
  }, [runName, namespaceName]);

  // Fetch logs for the active step, with short polling for running steps
  useEffect(() => {
    if (!statusState?.steps || !activeStepName || !namespaceName) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const activeStep: WorkflowStepStatus | undefined = statusState.steps.find(
      step => step.name === activeStepName,
    );
    const isRunningStep =
      activeStep?.phase?.toLowerCase() === 'running' &&
      !isTerminalStatus(statusState.status);

    const fetchLogs = async (useSinceSeconds: boolean) => {
      try {
        if (!cancelled && !useSinceSeconds) {
          setLogsLoading(true);
          setLogsError(null);
        }

        const entries = await client.getWorkflowRunStepLogs(
          namespaceName,
          runName,
          {
            step: activeStepName,
            sinceSeconds: useSinceSeconds ? 20 : undefined,
          },
        );

        if (cancelled) return;

        setLogsByStep(prev => ({
          ...prev,
          [activeStepName]: useSinceSeconds
            ? deduplicateLogs([...(prev[activeStepName] ?? []), ...entries])
            : entries,
        }));
      } catch (err) {
        if (cancelled) return;

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch logs';

        if (
          errorMessage.includes('ObservabilityNotConfigured') ||
          errorMessage.includes('OBSERVABILITY_NOT_CONFIGURED')
        ) {
          setIsLogsObsNotConfigured(true);
          setLogsError(
            'Observability is not configured for this workflow run. Logs cannot be retrieved.',
          );
        } else {
          setLogsError(errorMessage);
        }
      } finally {
        if (!cancelled && !useSinceSeconds) {
          setLogsLoading(false);
        }
      }
    };

    // Initial fetch (full history)
    fetchLogs(false);

    if (isRunningStep) {
      intervalId = window.setInterval(() => {
        fetchLogs(true);
      }, 10_000);
    }

    // eslint-disable-next-line consistent-return
    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
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

  const isObservabilityNotConfigured =
    isStatusObsNotConfigured || isLogsObsNotConfigured;
  const combinedError = statusError || logsError;

  if (combinedError) {
    if (isObservabilityNotConfigured) {
      return (
        <Alert severity="info">
          <Typography variant="body1">{combinedError}</Typography>
        </Alert>
      );
    }
    return (
      <Alert severity="error">
        <Typography variant="body1">{combinedError}</Typography>
      </Alert>
    );
  }

  if (!statusState || !statusState.steps || statusState.steps.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No steps available for this workflow run
      </Typography>
    );
  }

  const activeLogs: LogEntry[] =
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
              <Box className={classes.logsContainer}>
                {logsLoading && activeLogs.length === 0 && (
                  <Box className={classes.inlineLoadingContainer}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="textSecondary">
                      Loading logs...
                    </Typography>
                  </Box>
                )}

                {!logsLoading && activeLogs.length === 0 && (
                  <Typography variant="body2" className={classes.noLogsText}>
                    No logs available for this step
                  </Typography>
                )}

                {activeLogs.map((logEntry, index) => (
                  <Box
                    key={`${logEntry.timestamp ?? ''}-${logEntry.log.slice(
                      0,
                      40,
                    )}-${index}`}
                    style={{ marginBottom: '4px' }}
                  >
                    <Typography variant="body2" className={classes.logText}>
                      {logEntry.log}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};
