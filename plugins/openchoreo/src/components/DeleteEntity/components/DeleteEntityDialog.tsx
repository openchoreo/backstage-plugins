import { type ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { useStyles } from '../styles';

export interface DeleteEntityDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Human-friendly type label, e.g. "Component", "Project". */
  entityDisplayType: string;
  /** Name of the entity being deleted. */
  entityName: string;
  /** True while the delete request is in flight. */
  deleting: boolean;
  /** Error message to surface inside the dialog, if any. */
  error: string | null;
  /** Optional cascade note (e.g. "all components will also be deleted"). */
  cascadeNote?: ReactNode;
  /** Called when the dialog is dismissed (Cancel / backdrop). */
  onClose: () => void;
  /** Called when the user confirms the deletion. */
  onConfirm: () => void;
}

/**
 * Presentational confirmation dialog shared by every "delete" entry point
 * (entity-page context menu and the project-listing row action), so the
 * wording, styling and busy/error states stay identical across the portal.
 *
 * It owns no delete logic — the caller wires `onConfirm`/`onClose` and the
 * `deleting`/`error` state.
 */
export function DeleteEntityDialog({
  open,
  entityDisplayType,
  entityName,
  deleting,
  error,
  cascadeNote,
  onClose,
  onConfirm,
}: DeleteEntityDialogProps) {
  const classes = useStyles();
  const lowerType = entityDisplayType.toLowerCase();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-entity-dialog-title"
    >
      <DialogTitle id="delete-entity-dialog-title" disableTypography>
        <Typography variant="h4">Delete {entityDisplayType}</Typography>
      </DialogTitle>

      <DialogContent className={classes.deleteDialogContent}>
        <Typography variant="body1">
          Are you sure you want to delete the {lowerType}{' '}
          <span className={classes.entityName}>{entityName}</span>?
        </Typography>

        <Typography variant="body2" className={classes.warningText}>
          This action cannot be undone. The {lowerType} and all its associated
          resources will be permanently deleted.
        </Typography>

        {cascadeNote}

        {error && (
          <Typography variant="body2" color="error">
            Error: {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={deleting} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className={classes.deleteButton}
          variant="outlined"
          disabled={deleting}
          startIcon={
            deleting ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
