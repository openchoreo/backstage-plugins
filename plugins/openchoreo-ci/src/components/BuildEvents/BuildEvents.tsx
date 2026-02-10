import { useEffect, useMemo, useState } from 'react';
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
import type {
  ModelsBuild,
  WorkflowRunStatusResponse,
  WorkflowStepStatus,
} from '@openchoreo/backstage-plugin-common';
import {
  openChoreoCiClientApiRef,
  WorkflowRunEventEntry,
} from '../../api/OpenChoreoCiClientApi';
import { BuildStatusChip } from '../BuildStatusChip';
import { useStyles } from './styles';

interface EventsContentProps {
  build: ModelsBuild;
}

export const EventsContent = ({ build }: EventsContentProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoCiClientApiRef);

  const [statusState, setStatusState] =
    useState<WorkflowRunStatusResponse | null>(null);
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
        if (!activeStepName && data.steps && data.steps.length > 0) {
          const runningStep = data.steps.find(
            step => step.phase?.toLowerCase() === 'running',
          );

          const defaultStep =
            isTerminalStatus(data.status) || !runningStep
              ? data.steps[data.steps.length - 1]
              : runningStep;

          if (defaultStep?.name) {
            setActiveStepName(defaultStep.name);
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
                : 'Observability is not enabled for this component. Please enable observability to view workflow events.',
            );
          } catch {
            setStatusError(
              'Observability is not enabled for this component. Please enable observability to view workflow events.',
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

  // Fetch events for the active step
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

    const fetchEvents = async () => {
      try {
        if (!cancelled) {
          setEventsLoading(true);
          setEventsError(null);
        }

        const entries = await client.fetchWorkflowRunEvents(
          build.namespaceName,
          build.projectName,
          build.componentName,
          build.name,
          activeStepName,
          statusState.hasLiveObservability,
        );

        if (cancelled) {
          return;
        }

        setEventsByStep(prev => ({
          ...prev,
          [activeStepName]: entries,
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to fetch workflow events';

        if (errorMessage.includes('ObservabilityNotConfigured')) {
          setIsObservabilityNotConfigured(true);
          try {
            const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
            setEventsError(
              match
                ? match[1]
                : 'Observability is not enabled for this component. Please enable observability to view workflow events.',
            );
          } catch {
            setEventsError(
              'Observability is not enabled for this component. Please enable observability to view workflow events.',
            );
          }
        } else if (
          errorMessage.includes('HttpNotImplemented') ||
          errorMessage.includes('501 Not Implemented')
        ) {
          // TODO: Remove this once the endpoint is implemented in observability plane
          setIsObservabilityNotConfigured(true);
          setEventsError(
            'Events are not available for past workflow runs. This feature will be available soon.',
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

    // Initial fetch
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
  }, [client, build, activeStepName, statusState?.status]);

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
                  <BuildStatusChip status={step.phase} />
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
