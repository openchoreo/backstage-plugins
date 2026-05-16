import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@material-ui/core';

interface UndeployConfirmDialogProps {
  open: boolean;
  envName: string;
  retainPolicy?: 'Delete' | 'Retain';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UndeployConfirmDialog = ({
  open,
  envName,
  retainPolicy,
  busy = false,
  onCancel,
  onConfirm,
}: UndeployConfirmDialogProps) => {
  const isRetain = retainPolicy === 'Retain';

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Undeploy from {envName}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This deletes the ResourceReleaseBinding for{' '}
          <strong>{envName}</strong>.
        </DialogContentText>
        {isRetain ? (
          <DialogContentText>
            The binding's <code>retainPolicy</code> is{' '}
            <strong>Retain</strong>, so the controller's finalizer holds the
            actual delete and the data-plane state persists until the policy
            is flipped to <code>Delete</code>.
          </DialogContentText>
        ) : (
          <DialogContentText>
            The binding's <code>retainPolicy</code> is{' '}
            <strong>Delete</strong>, so the controller will cascade-delete the
            data-plane state once the binding is removed.
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="secondary"
          variant="contained"
          disabled={busy}
          startIcon={
            busy ? <CircularProgress size={14} color="inherit" /> : undefined
          }
        >
          Undeploy
        </Button>
      </DialogActions>
    </Dialog>
  );
};
