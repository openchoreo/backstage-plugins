import type { FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  deleteButton: {
    color: theme.palette.error.dark,
    borderColor: theme.palette.error.dark,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: `${theme.palette.error.dark}0A`, // 4% opacity
    },
  },
}));

interface DeleteConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deleteTarget: 'all' | 'component' | string | null;
  initialComponentTypeFormData: any;
  initialTraitFormDataMap: Record<string, any>;
  deleting: boolean;
}

export const DeleteConfirmationDialog: FC<DeleteConfirmationDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  deleteTarget,
  initialComponentTypeFormData,
  initialTraitFormDataMap,
  deleting,
}) => {
  const classes = useStyles();
  const hasInitialComponentTypeOverrides =
    initialComponentTypeFormData &&
    Object.keys(initialComponentTypeFormData).length > 0;

  const getDeleteMessage = () => {
    if (deleteTarget === 'all') {
      const items: string[] = [];
      if (hasInitialComponentTypeOverrides) {
        items.push(
          `Component overrides (${
            Object.keys(initialComponentTypeFormData).length
          } fields)`,
        );
      }
      Object.entries(initialTraitFormDataMap).forEach(([traitName, data]) => {
        if (Object.keys(data).length > 0) {
          items.push(
            `Trait[${traitName}] overrides (${
              Object.keys(data).length
            } fields)`,
          );
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
          Delete component-type overrides? This will revert these settings to
          defaults.
        </Typography>
      );
    }

    return (
      <Typography variant="body2" color="textSecondary">
        Delete trait <strong>{deleteTarget}</strong> overrides? This will revert
        these settings to defaults.
      </Typography>
    );
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Typography variant="h4">Delete Overrides?</Typography>
      </DialogTitle>

      <DialogContent>{getDeleteMessage()}</DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={deleting} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="outlined"
          disabled={deleting}
          className={classes.deleteButton}
        >
          {deleting ? 'Deleting...' : 'Confirm Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
