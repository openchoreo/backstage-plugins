import { makeStyles, alpha } from '@material-ui/core/styles';
import clsx from 'clsx';

const useStyles = makeStyles(theme => ({
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: '0.75rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
  },
  running: {
    color: theme.palette.info.dark,
    backgroundColor: alpha(theme.palette.info.main, 0.12),
  },
  ok: {
    color: theme.palette.success.dark,
    backgroundColor: alpha(theme.palette.success.main, 0.12),
  },
  fail: {
    color: theme.palette.error.dark,
    backgroundColor: alpha(theme.palette.error.main, 0.12),
  },
  warn: {
    color: theme.palette.warning.dark,
    backgroundColor: alpha(theme.palette.warning.main, 0.14),
  },
}));

export type RunPhaseTone = 'running' | 'ok' | 'fail' | 'warn' | 'muted';

/** Tone for a WorkflowRun / step phase (Argo and hook phases). */
export function phaseTone(phase: string | undefined): RunPhaseTone {
  switch (phase) {
    case 'Running':
    case 'Pending':
      return 'running';
    case 'Succeeded':
    case 'Dispatched':
      return 'ok';
    case 'Failed':
    case 'Error':
    case 'TimedOut':
    case 'DispatchFailed':
    case 'PlaneUnavailable':
      return 'fail';
    default:
      return 'muted';
  }
}

interface RunPhaseChipProps {
  phase?: string;
  /** Text to show instead of the phase */
  label?: string;
  tone?: RunPhaseTone;
}

export const RunPhaseChip = ({ phase, label, tone }: RunPhaseChipProps) => {
  const classes = useStyles();
  const t = tone ?? phaseTone(phase);
  return (
    <span
      className={clsx(classes.chip, {
        [classes.running]: t === 'running',
        [classes.ok]: t === 'ok',
        [classes.fail]: t === 'fail',
        [classes.warn]: t === 'warn',
      })}
    >
      {label ?? phase ?? 'Unknown'}
    </span>
  );
};
