import { useState } from 'react';
import { Box, Button } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import AddIcon from '@material-ui/icons/Add';
import RefreshIcon from '@material-ui/icons/Refresh';
import { TraitAccordion } from '../../../Traits/TraitAccordion';
import { TraitsEmptyState } from '../../../Traits/TraitsEmptyState';
import { AddTraitDialog } from '../../../Traits/AddTraitDialog';
import { EditTraitDialog } from '../../../Traits/EditTraitDialog';
import type { ComponentTrait } from '../../../../api/OpenChoreoClientApi';
import type { TraitWithState } from '../../../Traits/types';

interface TraitsContentProps {
  traitsState: TraitWithState[];
  onAdd: (trait: ComponentTrait) => void;
  onEdit: (instanceName: string, updated: ComponentTrait) => void;
  onDelete: (instanceName: string) => void;
  onUndo: (instanceName: string) => void;
  allowedTraits?: Array<{ kind?: string; name: string }>;
  disabled?: boolean;
  /** Error message when traits failed to load */
  loadError?: string | null;
  /** Callback to retry loading traits */
  onRetry?: () => void;
}

export const TraitsContent = ({
  traitsState,
  onAdd,
  onEdit,
  onDelete,
  onUndo,
  allowedTraits,
  disabled,
  loadError,
  onRetry,
}: TraitsContentProps) => {
  const [expandedTraitIds, setExpandedTraitIds] = useState<Set<string>>(
    new Set(),
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTraitForEdit, setSelectedTraitForEdit] =
    useState<ComponentTrait | null>(null);

  const existingInstanceNames = traitsState
    .filter(t => t.state !== 'deleted')
    .map(t => t.instanceName);

  const handleToggleAccordion = (instanceName: string) => {
    setExpandedTraitIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instanceName)) {
        newSet.delete(instanceName);
      } else {
        newSet.add(instanceName);
      }
      return newSet;
    });
  };

  const handleAddTrait = (trait: ComponentTrait) => {
    onAdd(trait);
    setAddDialogOpen(false);
  };

  const handleEditClick = (trait: ComponentTrait) => {
    setSelectedTraitForEdit(trait);
    setEditDialogOpen(true);
  };

  const handleEditSave = (updatedTrait: ComponentTrait) => {
    if (selectedTraitForEdit) {
      onEdit(selectedTraitForEdit.instanceName, updatedTrait);
    }
    setEditDialogOpen(false);
    setSelectedTraitForEdit(null);
  };

  const showEmptyState = traitsState.length === 0;

  if (loadError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={200}
        p={3}
        textAlign="center"
      >
        <Alert severity="error" style={{ maxWidth: 420, marginBottom: 16 }}>
          Failed to load traits attached to this component. You can still
          proceed, but trait configuration is unavailable until a successful
          reload.
        </Alert>
        {onRetry && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
          >
            Reload Traits
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Add button */}
      {!showEmptyState && (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box />
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            disabled={disabled}
          >
            Add Trait
          </Button>
        </Box>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <TraitsEmptyState onAddTrait={() => setAddDialogOpen(true)} />
      )}

      {/* Traits List */}
      {!showEmptyState &&
        traitsState.map(trait => (
          <TraitAccordion
            key={trait.instanceName}
            trait={trait}
            expanded={expandedTraitIds.has(trait.instanceName)}
            onToggle={() => handleToggleAccordion(trait.instanceName)}
            onEdit={() => handleEditClick(trait)}
            onDelete={() => onDelete(trait.instanceName)}
            onUndo={
              trait.state === 'deleted'
                ? () => onUndo(trait.instanceName)
                : undefined
            }
          />
        ))}

      {/* Dialogs */}
      <AddTraitDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddTrait}
        existingInstanceNames={existingInstanceNames}
        allowedTraits={allowedTraits}
      />
      <EditTraitDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedTraitForEdit(null);
        }}
        onSave={handleEditSave}
        trait={selectedTraitForEdit}
        existingInstanceNames={existingInstanceNames}
      />
    </Box>
  );
};
