import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';

interface AutoDeployConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isEnabling: boolean;
  isUpdating: boolean;
}

export const AutoDeployConfirmationDialog: FC<
  AutoDeployConfirmationDialogProps
> = ({ open, onCancel, onConfirm, isEnabling, isUpdating }) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEnabling ? 'Enable' : 'Disable'} Auto Deploy?
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary">
          {isEnabling
            ? 'Enabling auto deploy will automatically deploy the component to the default environment when component configurations change.'
            : 'Disabling auto deploy will require manual deployment when component configurations change.'}
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={isUpdating}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
