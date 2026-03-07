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
import type { WorkloadChanges } from './hooks/useWorkloadChanges';

interface WorkloadSaveConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  changes: WorkloadChanges;
  saving: boolean;
  /** Number of trait changes (added/modified/deleted) */
  traitChangesCount?: number;
  /** Number of parameter changes */
  parameterChangesCount?: number;
}

export const WorkloadSaveConfirmationDialog: FC<
  WorkloadSaveConfirmationDialogProps
> = ({
  open,
  onCancel,
  onConfirm,
  changes,
  saving,
  traitChangesCount = 0,
  parameterChangesCount = 0,
}) => {
  const totalChanges =
    changes.total + traitChangesCount + parameterChangesCount;

  // Convert WorkloadChanges to ChangesSection array for ChangesList component
  const sections: ChangesSection[] = useMemo(() => {
    const result: ChangesSection[] = [];

    if (changes.container.length > 0) {
      result.push({
        title: 'Container',
        changes: changes.container,
      });
    }

    if (changes.endpoints.length > 0) {
      result.push({
        title: 'Endpoints',
        changes: changes.endpoints,
      });
    }

    if (changes.dependencies.length > 0) {
      result.push({
        title: 'Dependencies',
        changes: changes.dependencies,
      });
    }

    if (traitChangesCount > 0) {
      result.push({
        title: 'Traits',
        changes: [
          {
            path: 'traits',
            type: 'modified' as const,
            oldValue: `${traitChangesCount} pending`,
            newValue: `${traitChangesCount} ${traitChangesCount === 1 ? 'change' : 'changes'}`,
          },
        ],
      });
    }

    if (parameterChangesCount > 0) {
      result.push({
        title: 'Parameters',
        changes: [
          {
            path: 'parameters',
            type: 'modified' as const,
            oldValue: `${parameterChangesCount} pending`,
            newValue: `${parameterChangesCount} ${parameterChangesCount === 1 ? 'change' : 'changes'}`,
          },
        ],
      });
    }

    return result;
  }, [changes, traitChangesCount, parameterChangesCount]);

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
          These changes will be applied to your component configuration.
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
          {saving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
