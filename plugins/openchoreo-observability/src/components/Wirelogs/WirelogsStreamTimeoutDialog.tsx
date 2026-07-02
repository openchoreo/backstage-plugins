import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';
import type { WirelogStreamStatus } from './types';

export interface WirelogsStreamTimeoutDialogProps {
  status: WirelogStreamStatus;
  /** Epoch ms when the stream began, from useWirelogsStream. */
  startedAt: number | null;
  /** Hard cap (ms) advertised by the backend `meta` frame. */
  hardTimeoutMs: number | null;
  /** Stop the stream (the user chose not to continue). */
  onStop: () => void;
}

/** "5 minutes" / "45 seconds" — for human-readable durations in the prompts. */
function humanizeDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 90) {
    return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Graduated soft-timeout warnings layered over the hard server cap. While a
 * stream is running it surfaces two confirmations — at one-third and
 * two-thirds of the hard cap — so the user can stop early or knowingly let it
 * approach the limit. Thresholds are proportional to the backend's
 * `hardTimeoutMs`, so the default 15-minute cap warns at ~5 and ~10 minutes,
 * and a lowered cap (e.g. for local testing) scales down with it.
 *
 * The hard stop itself is enforced by the backend; this component is purely
 * the heads-up. Each stage shows once per stream session.
 */
export const WirelogsStreamTimeoutDialog = ({
  status,
  startedAt,
  hardTimeoutMs,
  onStop,
}: WirelogsStreamTimeoutDialogProps) => {
  const isStreaming = status === 'streaming';
  const [now, setNow] = useState(() => Date.now());
  // Highest warning stage the user has already acknowledged this session.
  const [dismissedStage, setDismissedStage] = useState(0);

  // Tick once a second while streaming so elapsed time stays current.
  useEffect(() => {
    if (!isStreaming || !startedAt) {
      return undefined;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isStreaming, startedAt]);

  // New stream session (or restart) resets acknowledged stages.
  useEffect(() => {
    setDismissedStage(0);
  }, [startedAt]);

  if (!isStreaming || !startedAt || !hardTimeoutMs) {
    return null;
  }

  const elapsed = now - startedAt;
  const stage1At = hardTimeoutMs / 3;
  const stage2At = (hardTimeoutMs * 2) / 3;

  let stage = 0;
  if (elapsed >= stage2At) {
    stage = 2;
  } else if (elapsed >= stage1At) {
    stage = 1;
  }

  const open = stage > dismissedStage;
  if (!open) {
    return null;
  }

  const dismiss = () => setDismissedStage(stage);
  const remaining = Math.max(0, hardTimeoutMs - elapsed);
  const isFinalWarning = stage === 2;

  return (
    <Dialog
      open
      onClose={dismiss}
      maxWidth="sm"
      fullWidth
      aria-labelledby="wirelogs-stream-timeout-dialog-title"
    >
      <DialogTitle id="wirelogs-stream-timeout-dialog-title">
        {isFinalWarning
          ? 'Wirelogs stream will stop soon'
          : 'Wirelogs stream still running'}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" gutterBottom>
          This wirelogs stream has been running for about{' '}
          {humanizeDuration(elapsed)}.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {isFinalWarning
            ? `It will stop automatically in about ${humanizeDuration(
                remaining,
              )} (after ${humanizeDuration(
                hardTimeoutMs,
              )} total) to conserve resources. Keep streaming until then, or stop now?`
            : `It will stop automatically after ${humanizeDuration(
                hardTimeoutMs,
              )} to conserve resources. Keep streaming, or stop now?`}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onStop} color="secondary">
          Stop stream
        </Button>
        <Button onClick={dismiss} color="primary" variant="contained">
          Keep streaming
        </Button>
      </DialogActions>
    </Dialog>
  );
};
