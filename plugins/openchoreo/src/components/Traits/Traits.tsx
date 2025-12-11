import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import SaveIcon from '@material-ui/icons/Save';
import WarningRounded from '@material-ui/icons/WarningRounded';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useTraitsStyles } from './styles';
import { useTraitsData } from './hooks/useTraitsData';
import { usePendingChanges } from './hooks/usePendingChanges';
import { TraitsEmptyState } from './TraitsEmptyState';
import { TraitAccordion } from './TraitAccordion';
import { AddTraitDialog } from './AddTraitDialog';
import { EditTraitDialog } from './EditTraitDialog';
import { ConfirmChangesDialog } from './ConfirmChangesDialog';
import { ComponentTrait, updateComponentTraits } from '../../api/traits';

export const Traits = () => {
  const classes = useTraitsStyles();
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const { traits, loading, error, refetch } = useTraitsData();
  const {
    traitsState,
    pendingChanges,
    hasChanges,
    addTrait,
    editTrait,
    deleteTrait,
    undoDelete,
    discardAll,
    getTraitsForSave,
  } = usePendingChanges(traits);

  const [expandedTraitId, setExpandedTraitId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedTraitForEdit, setSelectedTraitForEdit] =
    useState<ComponentTrait | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Get all existing instance names (excluding deleted traits)
  const existingInstanceNames = traitsState
    .filter(t => t.state !== 'deleted')
    .map(t => t.instanceName);

  const handleToggleAccordion = (instanceName: string) => {
    setExpandedTraitId(prev => (prev === instanceName ? null : instanceName));
  };

  const handleAddTrait = (trait: ComponentTrait) => {
    addTrait(trait);
    setAddDialogOpen(false);
  };

  const handleEditClick = (trait: ComponentTrait) => {
    setSelectedTraitForEdit(trait);
    setEditDialogOpen(true);
  };

  const handleEditSave = (updatedTrait: ComponentTrait) => {
    if (selectedTraitForEdit) {
      editTrait(selectedTraitForEdit.instanceName, updatedTrait);
    }
    setEditDialogOpen(false);
    setSelectedTraitForEdit(null);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const traitsToSave = getTraitsForSave();
      await updateComponentTraits(entity, discovery, identity, traitsToSave);
      await refetch(); // Refresh the data
      setConfirmDialogOpen(false);
      discardAll(); // Clear pending changes after successful save
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmChanges = () => {
    setConfirmDialogOpen(true);
  };

  const handleDiscardAll = () => {
    discardAll();
  };

  if (loading) {
    return (
      <Box className={classes.container}>
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
          <Typography variant="body1" style={{ marginLeft: 16 }}>
            Loading traits...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={classes.container}>
        <Alert severity="error">
          Failed to load traits: {error.message || 'Unknown error'}
        </Alert>
      </Box>
    );
  }

  const showEmptyState = traitsState.length === 0;

  return (
    <Box className={classes.container}>
      {/* Header */}
      <Box className={classes.header}>
        <Box>
          <Typography variant="h5" className={classes.title}>
            Traits
          </Typography>
          <Typography variant="body2" className={classes.description}>
            Add traits to enhance your component functionality. Traits provide
            capabilities like persistent storage, observability, and security
            policies.
          </Typography>
        </Box>
        {!showEmptyState && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Trait
          </Button>
        )}
      </Box>

      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <Paper className={classes.unsavedBanner} elevation={0}>
          <Box className={classes.unsavedText}>
            <WarningRounded className={classes.unsavedIcon} />
            <Box>
              <Typography variant="subtitle2" className={classes.unsavedTitle}>
                Unsaved Changes
              </Typography>
              <Typography variant="body2" className={classes.unsavedMessage}>
                You have unsaved changes (
                {pendingChanges.added.length > 0 &&
                  `${pendingChanges.added.length} added`}
                {pendingChanges.added.length > 0 &&
                  (pendingChanges.modified.length > 0 ||
                    pendingChanges.deleted.length > 0) &&
                  ', '}
                {pendingChanges.modified.length > 0 &&
                  `${pendingChanges.modified.length} modified`}
                {pendingChanges.modified.length > 0 &&
                  pendingChanges.deleted.length > 0 &&
                  ', '}
                {pendingChanges.deleted.length > 0 &&
                  `${pendingChanges.deleted.length} deleted`}
                )
              </Typography>
            </Box>
          </Box>
          <Box className={classes.unsavedActions}>
            <Button size="small" variant="outlined" onClick={handleDiscardAll}>
              Discard All
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleConfirmChanges}
            >
              Save Changes
            </Button>
          </Box>
        </Paper>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <TraitsEmptyState onAddTrait={() => setAddDialogOpen(true)} />
      )}

      {/* Traits List */}
      {!showEmptyState && (
        <Box>
          {traitsState.map(trait => (
            <TraitAccordion
              key={trait.instanceName}
              trait={trait}
              expanded={expandedTraitId === trait.instanceName}
              onToggle={() => handleToggleAccordion(trait.instanceName)}
              onEdit={() => handleEditClick(trait)}
              onDelete={() => deleteTrait(trait.instanceName)}
              onUndo={
                trait.state === 'deleted'
                  ? () => undoDelete(trait.instanceName)
                  : undefined
              }
            />
          ))}
        </Box>
      )}

      {/* Add Trait Dialog */}
      <AddTraitDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddTrait}
        existingInstanceNames={existingInstanceNames}
      />

      {/* Edit Trait Dialog */}
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

      {/* Confirm Changes Dialog */}
      <ConfirmChangesDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setSaveError(null);
        }}
        onConfirm={handleSaveChanges}
        changes={pendingChanges}
        isLoading={saving}
      />

      {/* Save Error Alert */}
      {saveError && (
        <Alert severity="error" onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}
    </Box>
  );
};
