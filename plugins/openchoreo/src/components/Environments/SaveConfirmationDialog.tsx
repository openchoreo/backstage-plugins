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
import { GroupedChanges, Change } from './hooks/useOverrideChanges';
import { formatValue } from './utils/overrideUtils';

interface SaveConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  changes: GroupedChanges;
  environmentName: string;
  saving: boolean;
}

export const SaveConfirmationDialog: React.FC<SaveConfirmationDialogProps> = ({
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
    );

  const renderChangesList = (changesList: Change[]) => (
    <>
      {changesList.map((change, index) => (
        <Box
          key={index}
          mb={index < changesList.length - 1 ? 1 : 0}
          style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
        >
          {change.type === 'new' && (
            <Typography style={{ color: '#2e7d32' }}>
              <strong>{change.path}:</strong>{' '}
              <span style={{ color: '#666' }}>[New]</span>{' '}
              {formatValue(change.newValue)}
            </Typography>
          )}
          {change.type === 'modified' && (
            <Typography style={{ color: '#ed6c02' }}>
              <strong>{change.path}:</strong> {formatValue(change.oldValue)} →{' '}
              {formatValue(change.newValue)}
            </Typography>
          )}
          {change.type === 'removed' && (
            <Typography style={{ color: '#d32f2f' }}>
              <strong>{change.path}:</strong>{' '}
              <span style={{ color: '#666' }}>[Removed]</span>{' '}
              {formatValue(change.oldValue)}
            </Typography>
          )}
        </Box>
      ))}
    </>
  );

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Confirm Save Changes ({totalChanges} {totalChanges === 1 ? 'change' : 'changes'})
      </DialogTitle>

      <DialogContent dividers>
        <Box
          mt={2}
          mb={2}
          p={2}
          style={{
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {/* Component Overrides */}
          {changes.component.length > 0 && (
            <Box mb={2}>
              <Typography
                variant="subtitle2"
                style={{ fontWeight: 'bold', marginBottom: 8 }}
              >
                Component Overrides ({changes.component.length}{' '}
                {changes.component.length === 1 ? 'change' : 'changes'}):
              </Typography>
              {renderChangesList(changes.component)}
            </Box>
          )}

          {/* Trait Overrides */}
          {Object.keys(changes.traits).length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                style={{ fontWeight: 'bold', marginBottom: 8 }}
              >
                Trait Overrides:
              </Typography>
              {Object.entries(changes.traits).map(([traitName, traitChanges]) => (
                <Box key={traitName} mb={1.5} ml={2}>
                  <Typography
                    variant="caption"
                    style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}
                  >
                    {traitName} ({traitChanges.length}{' '}
                    {traitChanges.length === 1 ? 'change' : 'changes'}):
                  </Typography>
                  <Box ml={2}>{renderChangesList(traitChanges)}</Box>
                </Box>
              ))}
            </Box>
          )}

          {/* No changes */}
          {totalChanges === 0 && (
            <Typography variant="body2" color="textSecondary">
              No changes to save
            </Typography>
          )}
        </Box>

        <Typography variant="body2" color="textSecondary">
          This will trigger a redeployment of the <strong>{environmentName}</strong>{' '}
          environment.
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
