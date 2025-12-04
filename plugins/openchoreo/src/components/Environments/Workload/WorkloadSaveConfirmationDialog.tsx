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
}

export const WorkloadSaveConfirmationDialog: FC<
  WorkloadSaveConfirmationDialogProps
> = ({ open, onCancel, onConfirm, changes, saving }) => {
  // Convert WorkloadChanges to ChangesSection array for ChangesList component
  const sections: ChangesSection[] = useMemo(() => {
    const result: ChangesSection[] = [];

    if (changes.containers.length > 0) {
      result.push({
        title: 'Containers',
        changes: changes.containers,
      });
    }

    if (changes.endpoints.length > 0) {
      result.push({
        title: 'Endpoints',
        changes: changes.endpoints,
      });
    }

    if (changes.connections.length > 0) {
      result.push({
        title: 'Connections',
        changes: changes.connections,
      });
    }

    return result;
  }, [changes]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Confirm Save Changes ({changes.total}{' '}
        {changes.total === 1 ? 'change' : 'changes'})
      </DialogTitle>

      <DialogContent dividers>
        <ChangesList sections={sections} emptyMessage="No changes to save" />

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 16 }}
        >
          These changes will be applied to your workload configuration.
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
