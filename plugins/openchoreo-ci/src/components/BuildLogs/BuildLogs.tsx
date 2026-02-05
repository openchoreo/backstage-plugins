import { useState, useEffect, useMemo, useRef } from 'react';
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
import type {
  ModelsBuild,
  LogEntry,
  WorkflowRunStatusResponse,
  WorkflowStepStatus,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import { BuildStatusChip } from '../BuildStatusChip';
import { useStyles } from './styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

interface LogsContentProps {
  build: ModelsBuild;
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

export const LogsContent = ({ build }: LogsContentProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoCiClientApiRef);
  const [statusState, setStatusState] =
    useState<WorkflowRunStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeStepName, setActiveStepName] = useState<string | null>(null);
  const [logsByStep, setLogsByStep] = useState<Record<string, LogEntry[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isObservabilityNotConfigured, setIsObservabilityNotConfigured] =
    useState(false);

  const terminalStatuses = useMemo(
    () => ['completed', 'failed', 'succeeded', 'error'],
    [],
  );

  const isTerminalStatus = (status?: string) =>
    status ? terminalStatuses.includes(status.toLowerCase()) : false;

  const hasAutoSelectedStepRef = useRef(false);

  // Fetch workflow run status (including steps and logURL) with polling
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const fetchStatus = async () => {
      try {
        if (!cancelled) {
          setStatusLoading(true);
          setStatusError(null);
        }

        const data = await client.fetchWorkflowRunStatus(build);

        if (cancelled) {
          return;
        }

        setStatusState(data);

        // Auto-select initial step if none selected yet
        if (
          !hasAutoSelectedStepRef.current &&
          data.steps &&
          data.steps.length > 0
        ) {
          const runningStep = data.steps.find(
            step => step.phase?.toLowerCase() === 'running',
          );

          const defaultStep =
            isTerminalStatus(data.status) || !runningStep
              ? data.steps[data.steps.length - 1]
              : runningStep;

          if (defaultStep?.name) {
            setActiveStepName(defaultStep.name);
            hasAutoSelectedStepRef.current = true;
          }
        }

        // Stop polling once workflow reaches a terminal state
        if (isTerminalStatus(data.status) && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch build status';

        if (errorMessage.includes('ObservabilityNotConfigured')) {
          setIsObservabilityNotConfigured(true);
          try {
            const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
            setStatusError(
              match
                ? match[1]
                : 'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          } catch {
            setStatusError(
              'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          }
        } else {
          setStatusError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 10_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, build]);

  // Fetch logs for the active step, with short polling for running steps
  useEffect(() => {
    if (!statusState?.steps || !activeStepName) {
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const activeStep: WorkflowStepStatus | undefined = statusState.steps?.find(
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

        const entries = await client.fetchWorkflowRunLogs(
          build.namespaceName,
          build.projectName,
          build.componentName,
          build.name,
          statusState.hasLiveObservability,
          {
            step: activeStepName,
            sinceSeconds: useSinceSeconds ? 20 : undefined,
          },
        );

        if (cancelled) {
          return;
        }

        setLogsByStep(prev => ({
          ...prev,
          [activeStepName]: useSinceSeconds
            ? deduplicateLogs([...(prev[activeStepName] ?? []), ...entries])
            : entries,
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch build logs';

        if (errorMessage.includes('ObservabilityNotConfigured')) {
          setIsObservabilityNotConfigured(true);
          try {
            const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
            setLogsError(
              match
                ? match[1]
                : 'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          } catch {
            setLogsError(
              'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          }
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
    build,
    client,
    statusState?.hasLiveObservability,
    activeStepName,
    statusState?.status,
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

  const combinedError = statusError || logsError;

  if (combinedError) {
    // Show info alert for observability not configured (matching observability plugin style)
    if (isObservabilityNotConfigured) {
      return (
        <Alert severity="info">
          <Typography variant="body1">{combinedError}</Typography>
        </Alert>
      );
    }

    // Show error alert for other errors
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
                  <BuildStatusChip status={step.phase} />
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

                  {!logsLoading && activeLogs.length === 0 && (
                    <Typography variant="body2" className={classes.noLogsText}>
                      No logs available for this step
                    </Typography>
                  )}

                  {activeLogs.map((logEntry, index) => (
                    <Box key={index} style={{ marginBottom: '4px' }}>
                      <Typography variant="body2" className={classes.logText}>
                        {logEntry.log}
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
