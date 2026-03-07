import { useState } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
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
  disabled?: boolean;
}

export const TraitsContent = ({
  traitsState,
  onAdd,
  onEdit,
  onDelete,
  onUndo,
  disabled,
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
          <Typography variant="h6">Traits</Typography>
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
