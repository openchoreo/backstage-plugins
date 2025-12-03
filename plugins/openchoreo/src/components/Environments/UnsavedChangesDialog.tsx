import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';

interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onStay: () => void;
  changeCount: number;
}

export const UnsavedChangesDialog: FC<UnsavedChangesDialogProps> = ({
  open,
  onDiscard,
  onStay,
  changeCount,
}) => {
  return (
    <Dialog open={open} onClose={onStay} maxWidth="sm" fullWidth>
      <DialogTitle>Unsaved Changes</DialogTitle>

      <DialogContent>
        <Typography variant="body1">
          You have {changeCount} unsaved{' '}
          {changeCount === 1 ? 'change' : 'changes'}. Are you sure you want to
          leave?
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 8 }}
        >
          Your changes will be lost if you leave without saving.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onDiscard} color="secondary">
          Discard Changes
        </Button>
        <Button onClick={onStay} color="primary" variant="contained">
          Stay
        </Button>
      </DialogActions>
    </Dialog>
  );
};
