import type { FC } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core';

export interface ResourceRetainPolicySwitchDialogProps {
  open: boolean;
  isUpdating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * One-way friction for the Retain → Delete retain-policy switch. Retain
 * is the safety lock that blocks Remove deployment; flipping to Delete
 * removes that lock, so the user gets a chance to back out before the
 * deployment becomes deletable. Delete → Retain stays one-click since
 * it only adds safety.
 */
export const ResourceRetainPolicySwitchDialog: FC<
  ResourceRetainPolicySwitchDialogProps
> = ({ open, isUpdating, onCancel, onConfirm }) => {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isUpdating) onCancel();
      }}
      disableEscapeKeyDown={isUpdating}
      maxWidth="sm"
      fullWidth
      aria-labelledby="resource-retain-policy-switch-dialog-title"
    >
      <DialogTitle id="resource-retain-policy-switch-dialog-title">Switch retain policy to Delete?</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary">
          Setting retain policy to <strong>Delete</strong> will allow this
          deployment to be removed. Stored data may be lost depending on the
          underlying resource type.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={isUpdating}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="secondary"
          variant="contained"
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating...' : 'Set to Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
