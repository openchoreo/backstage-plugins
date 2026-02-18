import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../../api';
import { useSelectedNamespace } from '../../context';
import { WorkflowRunStatusChip } from '../WorkflowRunStatusChip';
import { useStyles } from './styles';
import type { WorkflowRunEventEntry, WorkflowStepStatus } from '../../types';

interface WorkflowRunEventsProps {
  runName: string;
}

export const WorkflowRunEvents = ({ runName }: WorkflowRunEventsProps) => {
  const classes = useStyles();
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const [statusState, setStatusState] = useState<{
    status: string;
    steps: WorkflowStepStatus[];
    hasLiveObservability: boolean;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeStepName, setActiveStepName] = useState<string | null>(null);
  const [eventsByStep, setEventsByStep] = useState<
    Record<string, WorkflowRunEventEntry[]>
  >({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [isObservabilityNotConfigured, setIsObservabilityNotConfigured] =
    useState(false);

  const terminalStatuses = useMemo(
    () => ['completed', 'failed', 'succeeded', 'error'],
    [],
  );

  const isTerminalStatus = (status?: string) =>
    status ? terminalStatuses.includes(status.toLowerCase()) : false;

  const hasAutoSelectedStepRef = useRef(false);

  // Fetch workflow run status (including steps) with polling
  useEffect(() => {
    if (!namespaceName || !runName) return;

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

        // Auto-select initial step only once (use ref to avoid re-selecting on each poll)
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
        if (cancelled) return;
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch run status';

        if (
          errorMessage.includes('ObservabilityNotConfigured') ||
          errorMessage.includes('OBSERVABILITY_NOT_CONFIGURED')
        ) {
          setIsObservabilityNotConfigured(true);
          setStatusError(
            'Observability is not configured for this workflow run. Events cannot be retrieved.',
          );
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
  }, [client, namespaceName, runName]);

  // Fetch events for the active step
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

    const fetchEvents = async () => {
      try {
        if (!cancelled) {
          setEventsLoading(true);
          setEventsError(null);
        }

        const entries = await client.getWorkflowRunEvents(
          namespaceName,
          runName,
          activeStepName,
        );

        if (cancelled) return;

        setEventsByStep(prev => ({
          ...prev,
          [activeStepName]: entries,
        }));
      } catch (err) {
        if (cancelled) return;

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch events';

        if (
          errorMessage.includes('ObservabilityNotConfigured') ||
          errorMessage.includes('OBSERVABILITY_NOT_CONFIGURED')
        ) {
          setIsObservabilityNotConfigured(true);
          setEventsError(
            'Observability is not configured for this workflow run. Events cannot be retrieved.',
          );
        } else if (
          errorMessage.includes('NOT_IMPLEMENTED') ||
          errorMessage.includes('501')
        ) {
          setIsObservabilityNotConfigured(true);
          setEventsError(
            'Events are not available for generic workflow runs. This feature will be available soon.',
          );
        } else {
          setEventsError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
        }
      }
    };

    fetchEvents();

    if (isRunningStep) {
      intervalId = window.setInterval(() => {
        fetchEvents();
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

  const combinedError = statusError || eventsError;

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

  const activeEvents: WorkflowRunEventEntry[] =
    (activeStepName && eventsByStep[activeStepName]) || [];

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

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
                <Box className={classes.eventsContainer}>
                  {eventsLoading && activeEvents.length === 0 && (
                    <Box className={classes.inlineLoadingContainer}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="textSecondary">
                        Loading events...
                      </Typography>
                    </Box>
                  )}

                  {!eventsLoading && activeEvents.length === 0 && (
                    <Typography
                      variant="body2"
                      className={classes.noEventsText}
                    >
                      No events available for this step
                    </Typography>
                  )}

                  {activeEvents.length > 0 && (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell className={classes.tableHeaderCell}>
                            Type
                          </TableCell>
                          <TableCell className={classes.tableHeaderCell}>
                            Reason
                          </TableCell>
                          <TableCell className={classes.tableHeaderCell}>
                            Message
                          </TableCell>
                          <TableCell className={classes.tableHeaderCell}>
                            Last Seen
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeEvents.map((event, index) => (
                          <TableRow key={`${event.timestamp}-${index}`}>
                            <TableCell className={classes.tableCell}>
                              {event.type}
                            </TableCell>
                            <TableCell className={classes.tableCell}>
                              {event.reason}
                            </TableCell>
                            <TableCell className={classes.messageCell}>
                              {event.message}
                            </TableCell>
                            <TableCell className={classes.tableCell}>
                              {formatTimestamp(event.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" className={classes.noEventsText}>
                  Expand this step to view events.
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};
