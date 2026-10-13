import { Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  blockingFailure,
  hasHooks,
  type EnvironmentHooks,
} from '../hooks/hookModel';

export interface HooksNote {
  severity: 'error' | 'warning' | 'info';
  text: string;
}

/**
 * The one thing to know about an environment's hooks right now: a failure
 * that blocks or alerts, a failure that was ignored, or hooks still running.
 */
export function hooksNote(
  hooks: EnvironmentHooks | undefined,
): HooksNote | null {
  if (!hasHooks(hooks)) return null;
  const failure = blockingFailure(hooks);
  if (failure) {
    const detail = failure.status?.message
      ? `: ${failure.status.message}`
      : '.';
    return failure.phase === 'preDeploy'
      ? {
          severity: 'error',
          text: `Blocked by ${failure.name}; the release was not deployed${detail}`,
        }
      : {
          severity: 'error',
          text: `After-deploy hook ${failure.name} failed; the deployment is marked degraded${detail}`,
        };
  }
  const all = [...hooks!.pre, ...hooks!.post];
  const ignored = all.filter(r => r.state === 'ignored');
  if (ignored.length > 0) {
    return {
      severity: 'warning',
      text: `${ignored.map(r => r.name).join(', ')} failed but ${
        ignored.length === 1 ? 'is' : 'are'
      } set to ignore failures, so the release deployed anyway.`,
    };
  }
  const runningPre = hooks!.pre.filter(r => r.state === 'running');
  if (runningPre.length > 0) {
    return {
      severity: 'info',
      text: `Waiting for before-deploy hooks: ${runningPre
        .map(r => r.name)
        .join(', ')}. The release deploys once every blocking hook passes.`,
    };
  }
  return null;
}

interface EnvironmentHooksNoteProps {
  hooks: EnvironmentHooks | undefined;
}

/** "Deployment hooks" body in the environment detail panel. */
export const EnvironmentHooksNote = ({ hooks }: EnvironmentHooksNoteProps) => {
  const note = hooksNote(hooks);
  return (
    <>
      {note && (
        <Alert severity={note.severity} data-testid="env-hooks-note">
          {note.text}
        </Alert>
      )}
      <Typography variant="body2" color="textSecondary">
        Select a hook on the environment card to see its logs, events and
        details.
      </Typography>
    </>
  );
};
