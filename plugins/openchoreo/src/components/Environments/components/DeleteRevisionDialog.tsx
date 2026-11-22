import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type {
  BindingRevision,
  DeleteBindingRevisionResponse,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  type BindingKind,
  describeDeleteRevisionError,
  healthPill,
  isActive,
  isNotFound,
  revisionName,
  revisionNumber,
} from '../utils/revisionUtils';

const useStyles = makeStyles(theme => ({
  details: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    marginBottom: theme.spacing(2),
  },
  label: {
    color: theme.palette.text.secondary,
  },
  checking: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
}));

export interface DeleteRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whose revision; defaults to a Component's ReleaseBinding. */
  kind?: BindingKind;
  bindingName: string;
  environmentName: string;
  /** The revision to delete. */
  target: BindingRevision | null;
  /** Called after the revision is deleted. */
  onDeleted: (result: DeleteBindingRevisionResponse) => void;
  /**
   * Called when the revision turns out to be gone already, so the history
   * can be refreshed.
   */
  onTargetMissing?: () => void;
}

type Check =
  | { state: 'checking' }
  | { state: 'allowed' }
  | { state: 'refused'; message: string };

/**
 * Confirms deleting one revision from a binding's history. Opening it asks
 * the server whether the revision may be deleted (a dry run), so a
 * protected revision is refused before anything is offered; only Delete
 * deletes it. The server checks again on delete.
 */
export const DeleteRevisionDialog = ({
  open,
  onClose,
  kind = 'component',
  bindingName,
  environmentName,
  target,
  onDeleted,
  onTargetMissing,
}: DeleteRevisionDialogProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const [check, setCheck] = useState<Check>({ state: 'checking' });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const targetName = target?.metadata.name ?? '';

  const deleteRevision = useCallback(
    (dryRun: boolean) =>
      kind === 'resource'
        ? client.deleteResourceReleaseBindingRevision(
            entity,
            bindingName,
            targetName,
            dryRun,
          )
        : client.deleteReleaseBindingRevision(
            entity,
            bindingName,
            targetName,
            dryRun,
          ),
    [client, entity, kind, bindingName, targetName],
  );

  useEffect(() => {
    if (!open || !target) return undefined;
    let cancelled = false;
    setDeleteError(null);
    setDeleting(false);
    setCheck({ state: 'checking' });
    deleteRevision(true)
      .then(() => !cancelled && setCheck({ state: 'allowed' }))
      .catch(e => {
        if (cancelled) return;
        setCheck({ state: 'refused', message: describeDeleteRevisionError(e) });
        if (isNotFound(e)) onTargetMissing?.();
      });
    return () => {
      cancelled = true;
    };
    // onTargetMissing is a callback prop; re-checking when it changes
    // identity would repeat the request on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, deleteRevision]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteRevision(false);
      onDeleted(result);
      onClose();
    } catch (e) {
      setDeleteError(describeDeleteRevisionError(e));
      if (isNotFound(e)) onTargetMissing?.();
    } finally {
      setDeleting(false);
    }
  };

  const shownName = target ? revisionName(target) : '';
  const number = target ? revisionNumber(target) : 0;

  return (
    <Dialog
      open={open}
      onClose={deleting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-revision-title"
    >
      <DialogTitle id="delete-revision-title">
        Delete revision {shownName}?
      </DialogTitle>
      <DialogContent dividers>
        {target && (
          <Box
            className={classes.details}
            data-testid="delete-revision-details"
          >
            <span className={classes.label}>Revision</span>
            <span>
              {shownName} (revision {number})
            </span>
            <span className={classes.label}>Binding</span>
            <span>{bindingName}</span>
            <span className={classes.label}>Environment</span>
            <span>{environmentName}</span>
            <span className={classes.label}>Status</span>
            <span>
              {isActive(target) ? 'Active' : 'Inactive'}
              {target.status?.health
                ? ` · ${healthPill(target.status.health).label}`
                : ''}
            </span>
          </Box>
        )}

        <Alert severity="warning">
          Deleting this revision removes it from the rollback history: it can no
          longer be rolled back to, and it cannot be restored. The other
          revisions keep their numbers, and r{number} is never reused.
        </Alert>

        {check.state === 'checking' && (
          <Box className={classes.checking} data-testid="delete-check-loading">
            <CircularProgress size={18} />
            <Typography variant="body2" color="textSecondary">
              Checking that the revision can be deleted…
            </Typography>
          </Box>
        )}

        {check.state === 'refused' && (
          <Box mt={2}>
            <Alert severity="error" data-testid="delete-refused">
              {check.message}
            </Alert>
          </Box>
        )}

        {deleteError && (
          <Box mt={2}>
            <Alert severity="error" data-testid="delete-error">
              {deleteError}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleDelete}
          disabled={check.state !== 'allowed' || deleting}
          startIcon={
            deleting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {deleting ? 'Deleting…' : 'Delete revision'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
