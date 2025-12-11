import { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
} from '@material-ui/core';
import { useTraitsStyles } from './styles';
import { PendingChanges } from './types';
import { ChangeDiff, Change } from '@openchoreo/backstage-plugin-react';

interface ConfirmChangesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  changes: PendingChanges;
  isLoading: boolean;
}

export const ConfirmChangesDialog: React.FC<ConfirmChangesDialogProps> = ({
  open,
  onClose,
  onConfirm,
  changes,
  isLoading,
}) => {
  const classes = useTraitsStyles();

  // Convert PendingChanges to Change[] format for ChangeDiff component
  const changesList: Change[] = useMemo(() => {
    const result: Change[] = [];

    // Added traits
    changes.added.forEach(trait => {
      result.push({
        path: `traits.${trait.instanceName}`,
        type: 'new',
        newValue: {
          name: trait.name,
          instanceName: trait.instanceName,
          ...(trait.parameters && { parameters: trait.parameters }),
        },
      });
    });

    // Modified traits
    changes.modified.forEach(({ original, updated }) => {
      // Show instance name change if different
      if (original.instanceName !== updated.instanceName) {
        result.push({
          path: `traits.${original.instanceName}.instanceName`,
          type: 'modified',
          oldValue: original.instanceName,
          newValue: updated.instanceName,
        });
      }

      // Show trait name change if different
      if (original.name !== updated.name) {
        result.push({
          path: `traits.${updated.instanceName}.name`,
          type: 'modified',
          oldValue: original.name,
          newValue: updated.name,
        });
      }

      // Show parameter changes
      const oldParams = original.parameters || {};
      const newParams = updated.parameters || {};
      const allKeys = new Set([
        ...Object.keys(oldParams),
        ...Object.keys(newParams),
      ]);

      allKeys.forEach(key => {
        const oldValue = oldParams[key];
        const newValue = newParams[key];

        if (oldValue !== undefined && newValue === undefined) {
          result.push({
            path: `traits.${updated.instanceName}.parameters.${key}`,
            type: 'removed',
            oldValue,
          });
        } else if (oldValue === undefined && newValue !== undefined) {
          result.push({
            path: `traits.${updated.instanceName}.parameters.${key}`,
            type: 'new',
            newValue,
          });
        } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          result.push({
            path: `traits.${updated.instanceName}.parameters.${key}`,
            type: 'modified',
            oldValue,
            newValue,
          });
        }
      });
    });

    // Deleted traits
    changes.deleted.forEach(trait => {
      result.push({
        path: `traits.${trait.instanceName}`,
        type: 'removed',
        oldValue: {
          name: trait.name,
          instanceName: trait.instanceName,
          ...(trait.parameters && { parameters: trait.parameters }),
        },
      });
    });

    return result;
  }, [changes]);

  const hasChanges =
    changes.added.length > 0 ||
    changes.modified.length > 0 ||
    changes.deleted.length > 0;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Confirm Changes</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        {!hasChanges && (
          <Typography variant="body2" className={classes.diffNone}>
            No changes to save
          </Typography>
        )}

        {hasChanges && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Review the changes below before confirming:
            </Typography>

            {changesList.map((change, index) => (
              <ChangeDiff key={index} change={change} showPath />
            ))}

            <Box mt={3}>
              <Typography variant="body2" color="textSecondary">
                {changes.added.length > 0 &&
                  `${changes.added.length} trait${
                    changes.added.length > 1 ? 's' : ''
                  } will be added. `}
                {changes.modified.length > 0 &&
                  `${changes.modified.length} trait${
                    changes.modified.length > 1 ? 's' : ''
                  } will be modified. `}
                {changes.deleted.length > 0 &&
                  `${changes.deleted.length} trait${
                    changes.deleted.length > 1 ? 's' : ''
                  } will be deleted.`}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Go Back
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={isLoading || !hasChanges}
          startIcon={isLoading && <CircularProgress size={16} />}
        >
          {isLoading ? 'Saving...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
