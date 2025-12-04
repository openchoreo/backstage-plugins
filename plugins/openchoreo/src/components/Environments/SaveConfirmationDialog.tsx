import { useMemo, type FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';
import {
  ChangesList,
  type ChangesSection,
} from '@openchoreo/backstage-plugin-react';
import { GroupedChanges } from './hooks/useOverrideChanges';

interface SaveConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  changes: GroupedChanges;
  environmentName: string;
  saving: boolean;
}

export const SaveConfirmationDialog: FC<SaveConfirmationDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  changes,
  environmentName,
  saving,
}) => {
  const totalChanges =
    changes.component.length +
    Object.values(changes.traits).reduce(
      (sum, traitChanges) => sum + traitChanges.length,
      0,
    ) +
    (changes.workload?.length || 0);

  // Convert GroupedChanges to ChangesSection array for ChangesList component
  const sections: ChangesSection[] = useMemo(() => {
    const result: ChangesSection[] = [];

    if (changes.component.length > 0) {
      result.push({
        title: 'Component Overrides',
        changes: changes.component,
      });
    }

    // Add each trait as a separate section
    Object.entries(changes.traits).forEach(([traitName, traitChanges]) => {
      if (traitChanges.length > 0) {
        result.push({
          title: `Trait: ${traitName}`,
          changes: traitChanges,
        });
      }
    });

    if (changes.workload && changes.workload.length > 0) {
      result.push({
        title: 'Workload Overrides',
        changes: changes.workload,
      });
    }

    return result;
  }, [changes]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Confirm Save Changes ({totalChanges}{' '}
        {totalChanges === 1 ? 'change' : 'changes'})
      </DialogTitle>

      <DialogContent dividers>
        <ChangesList sections={sections} emptyMessage="No changes to save" />

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          This will trigger a redeployment of the{' '}
          <strong>{environmentName}</strong> environment.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Confirm Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
