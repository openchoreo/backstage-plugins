import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';

interface RemoveDeploymentConfirmationDialogProps {
  open: boolean;
  environmentName: string;
  onCancel: () => void;
  onConfirm: () => void;
  isRemoving: boolean;
}

/**
 * Destructive confirmation for "Remove deployment" — different from
 * Undeploy. Undeploy keeps the binding and overrides; Remove deletes
 * the release binding, all environment-specific overrides, and any
 * config bound to that env. The action is not reversible from the UI.
 */
export const RemoveDeploymentConfirmationDialog: FC<
  RemoveDeploymentConfirmationDialogProps
> = ({ open, environmentName, onCancel, onConfirm, isRemoving }) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Remove deployment from {environmentName}?</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" paragraph>
          This will delete the <strong>release binding</strong> for{' '}
          <strong>{environmentName}</strong>. As a result:
        </Typography>
        <ul style={{ marginTop: 0, paddingLeft: 20 }}>
          <li>
            <Typography variant="body2" color="textSecondary">
              Environment-specific configuration overrides will be lost
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="textSecondary">
              Dataplane (Kubernetes) resources will be torn down
            </Typography>
          </li>
        </ul>
        <Typography variant="body2" color="error">
          This action cannot be undone. To re-deploy later you will need to
          configure overrides again.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={isRemoving}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="secondary"
          variant="contained"
          disabled={isRemoving}
        >
          {isRemoving ? 'Removing...' : 'Remove deployment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
