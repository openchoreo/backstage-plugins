import { useEffect, useState } from 'react';
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
import { VirtualizedLogList } from '@openchoreo/backstage-plugin-react';
import {
  isStepLive,
  isTerminalStatus,
} from '@openchoreo/backstage-plugin-common';
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
    // Padding (not margin) so the row's spacing is included in the height
    // measured by VirtualizedLogList.
    paddingBottom: theme.spacing(0.5),
    whiteSpace: 'pre-wrap',
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
  /** Explicit namespace override; falls back to the NamespaceContext value. */
  namespaceName?: string;
}

export const WorkflowRunStepLogs = ({
  runName,
  namespaceName: namespaceNameProp,
}: WorkflowRunStepLogsProps) => {
  const classes = useStyles();
  const client = useApi(genericWorkflowsClientApiRef);
  const contextNamespace = useSelectedNamespace();
  const namespaceName = namespaceNameProp ?? contextNamespace;

  const [statusState, setStatusState] =
    useState<WorkflowRunStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeStepName, setActiveStepName] = useState<string | null>(null);
  const [logsByStep, setLogsByStep] = useState<Record<string, string[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

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

  // The active step's logs grow while it is running, so pin the viewport to
  // the newest line (follow-tail) only for a live step.
  const activeStep = statusState.steps.find(
    step => step.name === activeStepName,
  );
  const isActiveStepLive = isStepLive(activeStep, statusState.status);

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

                  {activeLogs.length > 0 && (
                    <VirtualizedLogList
                      itemCount={activeLogs.length}
                      maxHeight={600}
                      estimatedRowHeight={20}
                      followTail={isActiveStepLive}
                      // Include the step name so switching steps invalidates
                      // tanstack's per-key measurement cache — otherwise a
                      // short-line step's cached row heights would be reused
                      // for the next step's wrapped output.
                      getItemKey={index => `${activeStepName}:${index}`}
                      renderRow={index => (
                        <Typography variant="body2" className={classes.logText}>
                          {activeLogs[index]}
                        </Typography>
                      )}
                    />
                  )}
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
