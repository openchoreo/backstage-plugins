import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type HookRunStep,
} from '../../../api/OpenChoreoClientApi';
import { RunPhaseChip } from './RunPhaseChip';

const LIVE_POLL_MS = 4000;
const TERMINAL = new Set([
  'Succeeded',
  'Failed',
  'Error',
  'Skipped',
  'Omitted',
]);

/**
 * Orders steps by start time, oldest first, so a run reads top to bottom in
 * the order it executed (the backend's order is not chronological: Argo's
 * onExit handler can come first). Steps that have not started keep their
 * relative order after the started ones.
 */
export function orderStepsByStart(steps: HookRunStep[]): HookRunStep[] {
  const started = (s: HookRunStep) =>
    s.startedAt ? Date.parse(s.startedAt) : Number.POSITIVE_INFINITY;
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => started(a.step) - started(b.step) || a.index - b.index)
    .map(({ step }) => step);
}

const useStyles = makeStyles(theme => ({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    width: '100%',
  },
  stepName: {
    flex: 1,
    fontWeight: 500,
  },
  logBox: {
    position: 'relative',
    width: '100%',
    margin: 0,
    padding: theme.spacing(1.5, 6, 1.5, 2),
    boxSizing: 'border-box',
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.8rem',
    lineHeight: '20px',
    // Tools like trivy print box-drawn tables; keep lines intact and scroll.
    whiteSpace: 'pre',
    overflow: 'auto',
    maxHeight: 480,
  },
  copy: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  errorLine: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  events: {
    width: '100%',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: '0.8rem',
  },
  eventRow: {
    display: 'grid',
    gridTemplateColumns: '80px 130px minmax(0, 1fr) 170px',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 2),
    '&:nth-child(even)': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  eventHead: {
    fontWeight: 600,
  },
  warning: {
    color: theme.palette.warning.dark,
    fontWeight: 600,
  },
  message: {
    overflowWrap: 'anywhere',
  },
}));

const ERROR_LINE = /\b(error|fatal|failed|critical)\b/i;

function StepLogs({
  namespaceName,
  runName,
  step,
}: {
  namespaceName: string;
  runName: string;
  step: HookRunStep;
}) {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const live = !TERMINAL.has(step.phase);
  const { data, loading, error } = useOpenChoreoQuery(
    ['hook-run-logs', namespaceName, runName, step.name],
    () => client.fetchHookRunLogs(namespaceName, runName, step.name),
    { refetchInterval: live ? LIVE_POLL_MS : false },
  );

  if (loading) return <CircularProgress size={20} />;
  if (error) {
    return (
      <Typography variant="body2" color="error">
        Could not load logs: {error.message}
      </Typography>
    );
  }
  if (data?.error) {
    return (
      <Typography variant="body2" color="textSecondary">
        {data.message || 'Logs are not available for this run.'}
      </Typography>
    );
  }
  const lines = (data?.logs ?? []).map(l => l.log);
  const text = lines.join('\n');
  return (
    <Box className={classes.logBox} data-testid={`hook-step-logs-${step.name}`}>
      <Tooltip title="Copy logs">
        <IconButton
          size="small"
          className={classes.copy}
          aria-label="Copy logs"
          onClick={() => navigator.clipboard?.writeText(text)}
        >
          <FileCopyOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {lines.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {live ? 'Waiting for output…' : 'No output.'}
        </Typography>
      )}
      {lines.map((line, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={ERROR_LINE.test(line) ? classes.errorLine : undefined}
        >
          {line}
        </div>
      ))}
      {live && lines.length > 0 && (
        <Typography variant="caption" color="primary">
          ● streaming…
        </Typography>
      )}
    </Box>
  );
}

function StepEvents({
  namespaceName,
  runName,
  step,
}: {
  namespaceName: string;
  runName: string;
  step: HookRunStep;
}) {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const live = !TERMINAL.has(step.phase);
  const { data, loading, error } = useOpenChoreoQuery(
    ['hook-run-events', namespaceName, runName, step.name],
    () => client.fetchHookRunEvents(namespaceName, runName, step.name),
    { refetchInterval: live ? LIVE_POLL_MS : false },
  );

  if (loading) return <CircularProgress size={20} />;
  if (error) {
    return (
      <Typography variant="body2" color="error">
        Could not load events: {error.message}
      </Typography>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No events for this step.
      </Typography>
    );
  }
  return (
    <Box
      className={classes.events}
      data-testid={`hook-step-events-${step.name}`}
    >
      <Box className={`${classes.eventRow} ${classes.eventHead}`}>
        <span>Type</span>
        <span>Reason</span>
        <span>Message</span>
        <span>Last seen</span>
      </Box>
      {data.map((e, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Box key={i} className={classes.eventRow}>
          <span className={e.type === 'Warning' ? classes.warning : undefined}>
            {e.type}
          </span>
          <span>{e.reason}</span>
          <span className={classes.message}>{e.message}</span>
          <span>{new Date(e.timestamp).toLocaleString()}</span>
        </Box>
      ))}
    </Box>
  );
}

interface HookRunStepsProps {
  namespaceName: string;
  runName: string;
  view: 'logs' | 'events';
  /** Whether the hook is still running (keeps the step list fresh). */
  live: boolean;
}

/**
 * One collapsible section per workflow step of a hook run, showing its logs
 * or its Kubernetes events. The failed (or running) step opens by default.
 */
export const HookRunSteps = ({
  namespaceName,
  runName,
  view,
  live,
}: HookRunStepsProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const { data, loading, error } = useOpenChoreoQuery(
    ['hook-run-status', namespaceName, runName],
    () => client.fetchHookRunStatus(namespaceName, runName),
    { refetchInterval: live ? LIVE_POLL_MS : false },
  );

  if (loading) return <CircularProgress size={24} />;
  if (error) {
    return (
      <Typography variant="body2" color="error">
        Could not load the hook run: {error.message}
      </Typography>
    );
  }
  const steps = orderStepsByStart(data?.steps ?? []);
  if (steps.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        The run has not started any steps yet.
      </Typography>
    );
  }

  const defaultOpen = (
    steps.find(s => s.phase === 'Failed' || s.phase === 'Error') ??
    steps.find(s => !TERMINAL.has(s.phase)) ??
    steps[steps.length - 1]
  ).name;
  const openName = open === undefined ? defaultOpen : open;

  return (
    <Box className={classes.list}>
      {steps.map(step => (
        <Accordion
          key={step.name}
          expanded={openName === step.name}
          onChange={(_, expanded) => setOpen(expanded ? step.name : null)}
          TransitionProps={{ unmountOnExit: true }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box className={classes.summary}>
              <Typography className={classes.stepName}>{step.name}</Typography>
              <RunPhaseChip phase={step.phase} />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {view === 'logs' ? (
              <StepLogs
                namespaceName={namespaceName}
                runName={runName}
                step={step}
              />
            ) : (
              <StepEvents
                namespaceName={namespaceName}
                runName={runName}
                step={step}
              />
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
