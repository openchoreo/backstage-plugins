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
          This will remove the deployment from{' '}
          <strong>{environmentName}</strong> entirely. The following will be
          deleted:
        </Typography>
        <ul style={{ marginTop: 0, paddingLeft: 20 }}>
          <li>
            <Typography variant="body2" color="textSecondary">
              Release binding
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="textSecondary">
              Environment-specific configuration overrides
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="textSecondary">
              Deployed Kubernetes resources for this environment
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
