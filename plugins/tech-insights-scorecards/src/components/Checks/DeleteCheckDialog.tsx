import { useState } from 'react';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import type { DynamicCheck } from '../../api/types';

const useStyles = makeStyles((theme: Theme) => ({
  deleteButton: {
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },
}));

interface DeleteCheckDialogProps {
  check: DynamicCheck | null;
  onCancel: () => void;
  onConfirm: (check: DynamicCheck) => Promise<void>;
}

export function DeleteCheckDialog({
  check,
  onCancel,
  onConfirm,
}: DeleteCheckDialogProps) {
  const classes = useStyles();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!check) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(check);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={!!check}
      onClose={deleting ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      aria-labelledby="delete-check-dialog-title"
    >
      <DialogTitle id="delete-check-dialog-title" disableTypography>
        <Typography variant="h4">Delete check</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete the check{' '}
          <strong>{check?.name}</strong>?
        </Typography>
        <Typography variant="body2" color="textSecondary">
          This action cannot be undone.
          {check?.status === 'published' &&
            ' The check is published, so scores will no longer include it.'}
        </Typography>
        {error && (
          <Alert severity="error" style={{ marginTop: 16 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={onCancel}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          variant="outlined"
          className={classes.deleteButton}
          onClick={handleDelete}
          disabled={deleting}
          startIcon={deleting ? <CircularProgress size={16} /> : undefined}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
