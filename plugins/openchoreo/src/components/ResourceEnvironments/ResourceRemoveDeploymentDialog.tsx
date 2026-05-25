import type { FC } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';

export interface ResourceRemoveDeploymentDialogProps {
  open: boolean;
  environmentName: string;
  isRemoving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Destructive confirmation for "Remove deployment" on a Resource binding.
 * Mirrors the Component-side dialog, with copy adapted for resources: the
 * binding's environment-specific overrides go away, and the underlying
 * Kubernetes resources are torn down. Whether persisted data actually
 * survives is up to the ResourceType implementation, so we surface that
 * uncertainty in plain text instead of overpromising or underpromising.
 *
 * Caller guards this dialog behind retainPolicy=Delete; the Remove
 * deployment button in the danger zone won't open it otherwise.
 */
export const ResourceRemoveDeploymentDialog: FC<
  ResourceRemoveDeploymentDialogProps
> = ({ open, environmentName, isRemoving, onCancel, onConfirm }) => {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isRemoving) onCancel();
      }}
      disableEscapeKeyDown={isRemoving}
      maxWidth="sm"
      fullWidth
      aria-labelledby="resource-remove-deployment-dialog-title"
    >
      <DialogTitle id="resource-remove-deployment-dialog-title">
        Remove deployment from {environmentName}?
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" paragraph>
          This will delete the <strong>resource release binding</strong> for{' '}
          <strong>{environmentName}</strong>. As a result:
        </Typography>
        <ul style={{ marginTop: 0, paddingLeft: 20 }}>
          <li>
            <Typography variant="body2" color="textSecondary">
              Environment-specific overrides for this binding will be lost
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="textSecondary">
              Underlying Kubernetes resources will be torn down. Stored data may
              be lost depending on the resource type implementation.
            </Typography>
          </li>
        </ul>
        <Typography variant="body2" color="error">
          This action cannot be undone.
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
