import { useMemo, type FC } from 'react';
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
import {
  ChangesList,
  deepCompareObjects,
  type ChangesSection,
  type Change,
} from '@openchoreo/backstage-plugin-react';
import type { WorkloadChanges } from './hooks/useWorkloadChanges';
import type { TraitWithState } from '../../Traits/types';

const useStyles = makeStyles(theme => ({
  groupHeader: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    padding: theme.spacing(1.5, 0, 0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
  },
  groupSection: {
    marginBottom: theme.spacing(2),
  },
}));

/**
 * Convert trait state entries into Change[] for display in the ChangesList.
 */
function buildTraitChanges(traitsState: TraitWithState[]): Change[] {
  const changes: Change[] = [];

  for (const trait of traitsState) {
    const label = `${trait.name} (${trait.instanceName})`;

    switch (trait.state) {
      case 'added':
        changes.push({
          path: label,
          type: 'new',
          newValue: 'Added',
        });
        break;
      case 'modified': {
        // Diff the original vs current parameters to show exactly what changed
        const originalParams = trait.originalData?.parameters ?? {};
        const currentParams = trait.parameters ?? {};
        const paramDiffs = deepCompareObjects(originalParams, currentParams);
        if (paramDiffs.length > 0) {
          for (const diff of paramDiffs) {
            changes.push({
              ...diff,
              path: `${label}.${diff.path}`,
            });
          }
        } else {
          // Fallback if parameters are identical but something else changed
          changes.push({
            path: label,
            type: 'modified',
            oldValue: 'Original',
            newValue: 'Modified',
          });
        }
        break;
      }
      case 'deleted':
        changes.push({
          path: label,
          type: 'removed',
          oldValue: 'Removed',
        });
        break;
      default:
        break;
    }
  }

  return changes;
}

interface WorkloadSaveConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  changes: WorkloadChanges;
  saving: boolean;
  traitsState?: TraitWithState[];
  parameterChanges?: Change[];
}

export const WorkloadSaveConfirmationDialog: FC<
  WorkloadSaveConfirmationDialogProps
> = ({
  open,
  onCancel,
  onConfirm,
  changes,
  saving,
  traitsState = [],
  parameterChanges = [],
}) => {
  const classes = useStyles();

  const traitChanges = useMemo(
    () => buildTraitChanges(traitsState),
    [traitsState],
  );

  const totalChanges =
    changes.total + traitChanges.length + parameterChanges.length;

  const workloadSections: ChangesSection[] = useMemo(() => {
    const result: ChangesSection[] = [];
    if (changes.container.length > 0) {
      result.push({ title: 'Container', changes: changes.container });
    }
    if (changes.endpoints.length > 0) {
      result.push({ title: 'Endpoints', changes: changes.endpoints });
    }

    if (changes.dependencies.length > 0) {
      result.push({
        title: 'Dependencies',
        changes: changes.dependencies,
      });
    }
    return result;
  }, [changes]);

  const componentSections: ChangesSection[] = useMemo(() => {
    const result: ChangesSection[] = [];
    if (parameterChanges.length > 0) {
      result.push({ title: 'Parameters', changes: parameterChanges });
    }
    if (traitChanges.length > 0) {
      result.push({ title: 'Traits', changes: traitChanges });
    }
    return result;
  }, [traitChanges, parameterChanges]);

  const hasWorkloadChanges = workloadSections.length > 0;
  const hasComponentChanges = componentSections.length > 0;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Confirm Save Changes ({totalChanges}{' '}
        {totalChanges === 1 ? 'change' : 'changes'})
      </DialogTitle>

      <DialogContent dividers>
        {hasWorkloadChanges && (
          <Box className={classes.groupSection}>
            <Typography className={classes.groupHeader}>
              Workload
            </Typography>
            <ChangesList
              sections={workloadSections}
              emptyMessage="No changes"
            />
          </Box>
        )}

        {hasComponentChanges && (
          <Box className={classes.groupSection}>
            <Typography className={classes.groupHeader}>
              Component
            </Typography>
            <ChangesList
              sections={componentSections}
              emptyMessage="No changes"
            />
          </Box>
        )}

        {!hasWorkloadChanges && !hasComponentChanges && (
          <Typography variant="body2" color="textSecondary">
            No changes to save.
          </Typography>
        )}

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
