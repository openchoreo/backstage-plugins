import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@material-ui/core';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deleteTarget: 'all' | 'component' | string | null;
  initialComponentTypeFormData: any;
  initialTraitFormDataMap: Record<string, any>;
  deleting: boolean;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  deleteTarget,
  initialComponentTypeFormData,
  initialTraitFormDataMap,
  deleting,
}) => {
  const hasInitialComponentTypeOverrides =
    initialComponentTypeFormData && Object.keys(initialComponentTypeFormData).length > 0;

  const getDeleteMessage = () => {
    if (deleteTarget === 'all') {
      const items: string[] = [];
      if (hasInitialComponentTypeOverrides) {
        items.push(
          `Component overrides (${Object.keys(initialComponentTypeFormData).length} fields)`,
        );
      }
      Object.entries(initialTraitFormDataMap).forEach(([traitName, data]) => {
        if (Object.keys(data).length > 0) {
          items.push(`Trait[${traitName}] overrides (${Object.keys(data).length} fields)`);
        }
      });

      return (
        <Box>
          <Typography variant="body2" gutterBottom>
            Delete the following overrides?
          </Typography>
          <Box component="ul" mt={1} mb={1}>
            {items.map((item, index) => (
              <Typography key={index} component="li" variant="body2">
                {item}
              </Typography>
            ))}
          </Box>
          <Typography variant="body2" color="textSecondary">
            This will revert to default settings and trigger a redeployment.
          </Typography>
        </Box>
      );
    } else if (deleteTarget === 'component') {
      return (
        <Typography variant="body2" color="textSecondary">
          Delete component-type overrides? This will revert these settings to defaults.
        </Typography>
      );
    } else {
      return (
        <Typography variant="body2" color="textSecondary">
          Delete trait <strong>{deleteTarget}</strong> overrides? This will revert these
          settings to defaults.
        </Typography>
      );
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Overrides?</DialogTitle>

      <DialogContent dividers>
        {getDeleteMessage()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="secondary"
          variant="contained"
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Confirm Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
