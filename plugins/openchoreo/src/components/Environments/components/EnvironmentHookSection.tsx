import type { MouseEvent as ReactMouseEvent } from 'react';
import { Box, Tooltip, Typography } from '@material-ui/core';
import { makeStyles, alpha } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import ScheduleIcon from '@material-ui/icons/Schedule';
import RemoveIcon from '@material-ui/icons/Remove';
import clsx from 'clsx';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import {
  HOOK_ROW_HEIGHT,
  HOOK_SECTION_HEADER_HEIGHT,
  hookSummary,
  type EnvironmentHooks,
  type HookGatePhase,
  type HookRow,
  type HookRowState,
} from '../hooks/hookModel';

const useStyles = makeStyles(theme => ({
  section: {
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(0.75),
    marginTop: theme.spacing(0.5),
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    height: HOOK_SECTION_HEADER_HEIGHT - 2,
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  headerTitle: {
    flex: 1,
  },
  summary: {
    fontWeight: 500,
    letterSpacing: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    width: '100%',
    height: HOOK_ROW_HEIGHT - 2,
    boxSizing: 'border-box',
    padding: theme.spacing(0, 1),
    borderRadius: 4,
    border: '1px solid',
    font: 'inherit',
    fontSize: '0.8rem',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 120ms ease, box-shadow 120ms ease',
    '&:hover': {
      boxShadow: theme.shadows[2],
    },
    '&:hover $name': {
      textDecoration: 'underline',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 1,
    },
  },
  icon: {
    fontSize: '0.95rem',
    flexShrink: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  state: {
    fontSize: '0.7rem',
    whiteSpace: 'nowrap',
  },
  running: {
    color: theme.palette.info.dark,
    borderColor: alpha(theme.palette.info.main, 0.5),
    backgroundColor: alpha(theme.palette.info.main, 0.08),
    '&:hover': {
      backgroundColor: alpha(theme.palette.info.main, 0.18),
    },
  },
  ok: {
    color: theme.palette.success.dark,
    borderColor: alpha(theme.palette.success.main, 0.5),
    backgroundColor: alpha(theme.palette.success.main, 0.08),
    '&:hover': {
      backgroundColor: alpha(theme.palette.success.main, 0.18),
    },
  },
  fail: {
    color: theme.palette.error.dark,
    borderColor: alpha(theme.palette.error.main, 0.5),
    backgroundColor: alpha(theme.palette.error.main, 0.08),
    '&:hover': {
      backgroundColor: alpha(theme.palette.error.main, 0.18),
    },
  },
  ignored: {
    color: theme.palette.warning.dark,
    borderColor: alpha(theme.palette.warning.main, 0.6),
    backgroundColor: alpha(theme.palette.warning.main, 0.08),
    '&:hover': {
      backgroundColor: alpha(theme.palette.warning.main, 0.18),
    },
  },
  muted: {
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
    backgroundColor: theme.palette.action.hover,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  tipName: {
    fontWeight: 600,
  },
  tipHint: {
    marginTop: 4,
    opacity: 0.8,
  },
  spin: {
    animation: '$spin 1s linear infinite',
  },
  '@keyframes spin': {
    to: { transform: 'rotate(360deg)' },
  },
}));

const SHORT: Record<HookRowState, string> = {
  running: 'running',
  ok: 'passed',
  fail: 'blocked',
  ignored: 'ignored',
  skipped: 'skipped',
  pending: 'waiting',
};

function StateIcon({
  state,
  className,
}: {
  state: HookRowState;
  className: string;
}) {
  const classes = useStyles();
  switch (state) {
    case 'running':
      return (
        <svg
          className={clsx(className, classes.spin)}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" />
        </svg>
      );
    case 'ok':
      return <CheckIcon className={className} aria-hidden />;
    case 'fail':
      return <CloseIcon className={className} aria-hidden />;
    case 'ignored':
      return <ReportProblemOutlinedIcon className={className} aria-hidden />;
    case 'skipped':
      return <RemoveIcon className={className} aria-hidden />;
    default:
      return <ScheduleIcon className={className} aria-hidden />;
  }
}

/** Hover card for a hook row: what happened, its policy and where to look. */
function HookRowTip({ row }: { row: HookRow }) {
  const classes = useStyles();
  const policy =
    row.mode === 'Async'
      ? 'Async · never blocks'
      : `Sync · on failure: ${row.onFailure}`;
  const when = row.status?.finishedAt ?? row.status?.startedAt;
  return (
    <>
      <div className={classes.tipName}>{row.name}</div>
      <div>
        {row.stateText}
        {when ? ` · ${formatRelativeTime(when)}` : ''}
      </div>
      <div>{policy}</div>
      {row.status?.message && <div>{row.status.message}</div>}
      <div className={classes.tipHint}>
        Click to open logs, events and details
      </div>
    </>
  );
}

interface EnvironmentHookSectionProps {
  hooks: EnvironmentHooks;
  onOpenHook: (phase: HookGatePhase, hookName: string) => void;
}

/**
 * Before / After deploy hook rows on an environment card (deployment hooks,
 * alpha). Each row opens that hook's run page.
 */
export const EnvironmentHookSection = ({
  hooks,
  onOpenHook,
}: EnvironmentHookSectionProps) => {
  const classes = useStyles();

  const renderPhase = (title: string, rows: HookRow[]) => {
    if (rows.length === 0) return null;
    return (
      <Box className={classes.section}>
        <Box className={classes.header}>
          <span className={classes.headerTitle}>{title}</span>
          <span className={classes.summary}>{hookSummary(rows)}</span>
        </Box>
        {rows.map(row => (
          <Tooltip
            key={`${row.phase}-${row.name}`}
            title={<HookRowTip row={row} />}
            placement="right"
            arrow
            enterDelay={300}
            // The card sits in a pan/zoom canvas; keep the popper with it.
            PopperProps={{ disablePortal: true }}
          >
            <button
              type="button"
              className={clsx(
                classes.row,
                row.state === 'running' && classes.running,
                row.state === 'ok' && classes.ok,
                row.state === 'fail' && classes.fail,
                row.state === 'ignored' && classes.ignored,
                (row.state === 'pending' || row.state === 'skipped') &&
                  classes.muted,
              )}
              aria-label={`${title} hook ${row.name}: ${row.stateText}. Open run`}
              data-testid={`env-hook-${row.phase}-${row.name}`}
              onClick={(e: ReactMouseEvent) => {
                // The card body selects the environment; a hook opens its run.
                e.stopPropagation();
                onOpenHook(row.phase, row.name);
              }}
            >
              <StateIcon state={row.state} className={classes.icon} />
              <Typography component="span" className={classes.name}>
                {row.name}
              </Typography>
              <span className={classes.state}>{SHORT[row.state]}</span>
            </button>
          </Tooltip>
        ))}
      </Box>
    );
  };

  return (
    <>
      {renderPhase('Before deploy', hooks.pre)}
      {renderPhase('After deploy', hooks.post)}
    </>
  );
};
