import { useEffect, useState } from 'react';
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
import {
  useWorkflowRunStatus,
  isTerminalStatus,
} from '../../hooks/useWorkflowRunStatus';
import type { WorkflowRunEventEntry, WorkflowStepStatus } from '../../types';

interface WorkflowRunEventsProps {
  runName: string;
}

export const WorkflowRunEvents = ({ runName }: WorkflowRunEventsProps) => {
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
    'Observability is not configured for this workflow run. Events cannot be retrieved.',
  );

  const [eventsByStep, setEventsByStep] = useState<
    Record<string, WorkflowRunEventEntry[]>
  >({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [isEventsObsNotConfigured, setIsEventsObsNotConfigured] =
    useState(false);

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
          setIsEventsObsNotConfigured(true);
          setEventsError(
            'Observability is not configured for this workflow run. Events cannot be retrieved.',
          );
        } else if (
          errorMessage.includes('NOT_IMPLEMENTED') ||
          errorMessage.includes('501')
        ) {
          setIsEventsObsNotConfigured(true);
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

  // Only status/observability errors block the whole view; eventsError is shown inline.
  if (statusError) {
    if (isStatusObsNotConfigured) {
      return (
        <Alert severity="info">
          <Typography variant="body1">{statusError}</Typography>
        </Alert>
      );
    }
    return (
      <Alert severity="error">
        <Typography variant="body1">{statusError}</Typography>
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
    const d = new Date(timestamp);
    return Number.isNaN(d.getTime()) ? timestamp : d.toLocaleString();
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
              <Box className={classes.eventsContainer}>
                {eventsError && (
                  <Alert severity={isEventsObsNotConfigured ? 'info' : 'error'}>
                    <Typography variant="body2">{eventsError}</Typography>
                  </Alert>
                )}

                {!eventsError && eventsLoading && activeEvents.length === 0 && (
                  <Box className={classes.inlineLoadingContainer}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="textSecondary">
                      Loading events...
                    </Typography>
                  </Box>
                )}

                {!eventsError &&
                  !eventsLoading &&
                  activeEvents.length === 0 && (
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
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};
