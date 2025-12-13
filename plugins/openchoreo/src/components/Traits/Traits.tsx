import { useState, useEffect, useRef, useContext, useMemo } from 'react';
import {
  useNavigate,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import type { Navigator } from 'react-router-dom';
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
import { UnsavedChangesDialog } from '@openchoreo/backstage-plugin-react';
import { useTraitsStyles } from './styles';
import { useTraitsData } from './hooks/useTraitsData';
import { usePendingChanges } from './hooks/usePendingChanges';
import { TraitsEmptyState } from './TraitsEmptyState';
import { TraitAccordion } from './TraitAccordion';
import { AddTraitDialog } from './AddTraitDialog';
import { EditTraitDialog } from './EditTraitDialog';
import { ConfirmChangesDialog } from './ConfirmChangesDialog';
import {
  openChoreoClientApiRef,
  ComponentTrait,
} from '../../api/OpenChoreoClientApi';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';

export const Traits = () => {
  const classes = useTraitsStyles();
  const { entity } = useEntity();
  const openChoreoClient = useApi(openChoreoClientApiRef);
  const notification = useNotification();
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

  const [expandedTraitIds, setExpandedTraitIds] = useState<Set<string>>(
    new Set(),
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [selectedTraitForEdit, setSelectedTraitForEdit] =
    useState<ComponentTrait | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Track if we should allow navigation (when user confirms discard)
  const allowNavigationRef = useRef(false);
  const pendingNavigationRef = useRef<{
    to: string;
    action: 'push' | 'replace';
  } | null>(null);
  const navigate = useNavigate();
  const navigation = useContext(NavigationContext);

  // Get all existing instance names (excluding deleted traits)
  const existingInstanceNames = traitsState
    .filter(t => t.state !== 'deleted')
    .map(t => t.instanceName);

  // Calculate total number of changes
  const totalChanges = useMemo(() => {
    return (
      pendingChanges.added.length +
      pendingChanges.modified.length +
      pendingChanges.deleted.length
    );
  }, [pendingChanges]);

  // Warn user before leaving page with unsaved changes (browser navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !allowNavigationRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Block in-app navigation when there are unsaved changes
  useEffect(() => {
    if (!hasChanges || !navigation) {
      return undefined;
    }

    const navigator = navigation.navigator as Navigator;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;

    // Override push method
    navigator.push = (to: any, state?: any) => {
      if (allowNavigationRef.current) {
        originalPush.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'push',
      };

      // Show confirmation dialog
      setUnsavedChangesDialogOpen(true);
    };

    // Override replace method
    navigator.replace = (to: any, state?: any) => {
      if (allowNavigationRef.current) {
        originalReplace.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'replace',
      };

      // Show confirmation dialog
      setUnsavedChangesDialogOpen(true);
    };

    // Cleanup - restore original methods
    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [hasChanges, navigation]);

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
      await openChoreoClient.updateComponentTraits(entity, traitsToSave);
      await refetch(); // Refresh the data
      setConfirmDialogOpen(false);
      discardAll(); // Clear pending changes after successful save

      // Show success notification
      notification.showSuccess('Traits updated successfully');
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to save changes';
      setSaveError(errorMessage);

      // Show error notification
      notification.showError(`Failed to update traits: ${errorMessage}`);
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
    <>
      {/* Notification Banner */}
      <NotificationBanner notification={notification.notification} />

      <Box className={classes.container}>
        {/* Header */}
        <Box className={classes.header}>
          <Box>
            <Typography variant="h5" className={classes.title}>
              Traits
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
                <Typography
                  variant="subtitle2"
                  className={classes.unsavedTitle}
                >
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
              <Button
                size="small"
                variant="outlined"
                onClick={handleDiscardAll}
              >
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
                expanded={expandedTraitIds.has(trait.instanceName)}
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

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={unsavedChangesDialogOpen}
          onDiscard={() => {
            // Discard all changes
            discardAll();
            // Allow navigation to proceed
            allowNavigationRef.current = true;
            setUnsavedChangesDialogOpen(false);

            // Proceed with the pending navigation
            if (pendingNavigationRef.current) {
              const { to, action } = pendingNavigationRef.current;
              if (action === 'push') {
                navigate(to);
              } else {
                navigate(to, { replace: true });
              }
              pendingNavigationRef.current = null;
            }

            // Reset the flag after navigation
            setTimeout(() => {
              allowNavigationRef.current = false;
            }, 100);
          }}
          onStay={() => {
            setUnsavedChangesDialogOpen(false);
            // Clear pending navigation
            pendingNavigationRef.current = null;
          }}
          changeCount={totalChanges}
        />

        {/* Save Error Alert */}
        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}
      </Box>
    </>
  );
};
