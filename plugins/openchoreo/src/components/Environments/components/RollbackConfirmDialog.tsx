import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type {
  BindingRevision,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  type BindingKind,
  describeRollbackError,
  isAutoDeployBlocked,
  isConcurrentModification,
  isNotFound,
  revisionName,
  revisionNumber,
} from '../utils/revisionUtils';
import { RollbackAutoDeployToggle } from './RollbackAutoDeployToggle';

/** The longest rollback reason the OpenChoreo API accepts, in characters. */
const MAX_MESSAGE_LENGTH = 1024;

const useStyles = makeStyles(theme => ({
  summary: {
    marginBottom: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  changes: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: theme.spacing(2),
    wordBreak: 'break-all',
  },
  field: {
    color: theme.palette.text.secondary,
  },
  warnings: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 0),
  },
}));

/** Renders a spec value compactly: unset, quoted strings, or JSON. */
export const formatSpecValue = (value: unknown): string => {
  if (value === undefined || value === null) return '(unset)';
  if (typeof value === 'string') return `"${value}"`;
  return JSON.stringify(value);
};

export interface RollbackConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which binding to roll back; defaults to a Component's ReleaseBinding. */
  kind?: BindingKind;
  bindingName: string;
  environmentName: string;
  /** The revision whose spec the rollback restores. */
  target: BindingRevision | null;
  /** Name of the revision active now, which the rollback replaces. */
  activeRevisionName?: string;
  /** Called after the rollback is applied. */
  onRolledBack: (result: RollbackResponse) => void;
  /**
   * Called when the target revision turns out to be gone (deleted since the
   * history was loaded), so the history can be refreshed.
   */
  onTargetMissing?: () => void;
}

type Preview =
  | { state: 'loading' }
  | { state: 'ready'; result: RollbackResponse }
  | { state: 'error'; message: string };

/**
 * Confirms a rollback. Opening it runs the rollback as a dry run and shows
 * the spec changes and every warning; only Confirm applies it. The server
 * repeats every check on apply and refuses a binding that changes while the
 * rollback is being written, after which the preview is refreshed. Confirm
 * sends only the target revision, though, so a binding changed between the
 * preview and Confirm (by a new deploy, say) is not refused: the rollback is
 * applied to it as it is then.
 */
export const RollbackConfirmDialog = ({
  open,
  onClose,
  kind = 'component',
  bindingName,
  environmentName,
  target,
  activeRevisionName,
  onRolledBack,
  onTargetMissing,
}: RollbackConfirmDialogProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const [preview, setPreview] = useState<Preview>({ state: 'loading' });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  // Set once auto deploy blocks the rollback, so the switch that turns it
  // off stays in the dialog after the block is lifted.
  const [autoDeployBlocked, setAutoDeployBlocked] = useState(false);

  const targetNumber = target ? revisionNumber(target) : 0;

  const rollback = useCallback(
    (dryRun: boolean, reason?: string) => {
      // The reason is only sent when there is one.
      const extra: [string] | [] = reason ? [reason] : [];
      return kind === 'resource'
        ? client.rollbackResourceReleaseBinding(
            entity,
            bindingName,
            targetNumber,
            dryRun,
            ...extra,
          )
        : client.rollbackReleaseBinding(
            entity,
            bindingName,
            targetNumber,
            dryRun,
            ...extra,
          );
    },
    [client, entity, kind, bindingName, targetNumber],
  );

  // Identifies the latest preview request. Closing the dialog or changing
  // its target bumps it, so a response to an earlier request is ignored.
  const previewRequest = useRef(0);

  const runPreview = useCallback(async () => {
    const request = ++previewRequest.current;
    setPreview({ state: 'loading' });
    try {
      const result = await rollback(true);
      if (request !== previewRequest.current) return;
      setPreview({ state: 'ready', result });
    } catch (e) {
      if (request !== previewRequest.current) return;
      setPreview({ state: 'error', message: describeRollbackError(e) });
      if (isAutoDeployBlocked(e)) setAutoDeployBlocked(true);
      if (isNotFound(e)) onTargetMissing?.();
    }
    // onTargetMissing is a callback prop; re-running the preview when it
    // changes identity would repeat the request on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollback]);

  useEffect(() => {
    if (!open || !target) {
      // A preview still in flight belongs to a dialog that is now closed.
      previewRequest.current++;
      return;
    }
    setApplyError(null);
    setApplying(false);
    setMessage('');
    setAutoDeployBlocked(false);
    // A new preview makes any earlier one stale.
    runPreview();
  }, [open, target, runPreview]);

  const result = preview.state === 'ready' ? preview.result : null;
  const shownName =
    result?.revisionDisplayName ?? (target ? revisionName(target) : '');
  const noChange =
    result?.warnings.some(w => w.code === 'NoSpecChange') ?? false;

  const handleConfirm = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const applied = await rollback(false, message.trim() || undefined);
      onRolledBack(applied);
      onClose();
    } catch (e) {
      setApplyError(describeRollbackError(e));
      // The binding moved since the preview: show what the rollback would
      // do now before letting the user confirm again.
      if (isConcurrentModification(e)) runPreview();
      if (isNotFound(e)) onTargetMissing?.();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={applying ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="rollback-confirm-title"
    >
      <DialogTitle id="rollback-confirm-title">
        Roll back {environmentName} to {target ? revisionName(target) : ''}?
      </DialogTitle>
      <DialogContent dividers>
        {preview.state === 'loading' && (
          <Box
            className={classes.loading}
            data-testid="rollback-preview-loading"
          >
            <CircularProgress size={18} />
            <Typography variant="body2" color="textSecondary">
              Checking what the rollback changes…
            </Typography>
          </Box>
        )}

        {preview.state === 'error' && (
          <Alert severity="error">{preview.message}</Alert>
        )}

        {autoDeployBlocked && kind === 'component' && (
          <RollbackAutoDeployToggle onChanged={runPreview} />
        )}

        {result && (
          <>
            <Typography variant="body2" className={classes.summary}>
              {target && (
                <>
                  Restores <strong>{revisionName(target)}</strong>
                  {activeRevisionName &&
                    activeRevisionName !== revisionName(target) &&
                    `, replacing the active ${activeRevisionName}`}
                  .{' '}
                </>
              )}
              {noChange
                ? `${shownName} is already active, so nothing changes.`
                : `No revision is created: ${shownName} becomes active again.`}
            </Typography>

            {result.changes.length > 0 && (
              <>
                <Typography className={classes.sectionTitle}>
                  Changes
                </Typography>
                <Box className={classes.changes} data-testid="rollback-changes">
                  {result.changes.map(c => (
                    <Box key={c.field} display="contents">
                      <span className={classes.field}>{c.field}</span>
                      <span>
                        {formatSpecValue(c.current)} →{' '}
                        {formatSpecValue(c.target)}
                      </span>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {result.warnings.length > 0 && (
              <>
                <Typography className={classes.sectionTitle}>
                  Warnings
                </Typography>
                <Box
                  className={classes.warnings}
                  data-testid="rollback-warnings"
                >
                  {result.warnings.map(w => (
                    <Alert
                      key={w.code}
                      severity={w.code === 'NoSpecChange' ? 'info' : 'warning'}
                    >
                      <strong>{w.code}</strong>: {w.message}
                    </Alert>
                  ))}
                </Box>
              </>
            )}
          </>
        )}

        {result && !noChange && (
          <Box mt={2}>
            <TextField
              id="rollback-message"
              label="Reason (optional)"
              placeholder="e.g. Payments failing since r4"
              helperText="Shown on the environment's events and in the audit log."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={applying}
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              variant="outlined"
              size="small"
              inputProps={{
                maxLength: MAX_MESSAGE_LENGTH,
                'data-testid': 'rollback-message',
              }}
            />
          </Box>
        )}

        {applyError && (
          <Box mt={2}>
            <Alert severity="error" data-testid="rollback-apply-error">
              {applyError}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applying}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={!result || applying}
          startIcon={
            applying ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {applying ? 'Rolling back…' : 'Roll back'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
