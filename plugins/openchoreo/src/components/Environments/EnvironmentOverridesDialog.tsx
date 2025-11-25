import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { patchReleaseBindingOverrides } from '../../api/environments';
import { makeStyles } from '@material-ui/core/styles';
import { OverrideSection } from './OverrideSection';
import { useOverrideChanges } from './hooks/useOverrideChanges';
import { useOverridesData } from './hooks/useOverridesData';
import { SaveConfirmationDialog } from './SaveConfirmationDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { calculateHasOverrides } from './overridesUtils';

const useStyles = makeStyles(theme => ({
  dialogContent: {
    minHeight: '400px',
    paddingTop: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    gap: theme.spacing(2),
  },
  helpText: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
}));

interface Environment {
  name: string;
  bindingName?: string;
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed';
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
}

interface EnvironmentOverridesDialogProps {
  open: boolean;
  onClose: () => void;
  environment: Environment | null;
  entity: Entity;
  onSaved: () => void;
}

export const EnvironmentOverridesDialog: React.FC<
  EnvironmentOverridesDialogProps
> = ({ open, onClose, environment, entity, onSaved }) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    'all' | 'component' | string | null
  >(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load data using custom hook
  const {
    loading,
    error: loadError,
    schemas,
    formState,
    expandedSections,
    setComponentTypeFormData,
    setTraitFormDataMap,
    setExpandedSections,
    reload,
  } = useOverridesData(
    entity,
    discovery,
    identityApi,
    environment?.name,
    environment?.deployment.releaseName,
    open,
  );

  const error = loadError || saveError;

  // Calculate changes
  const changes = useOverrideChanges(
    formState.initialComponentTypeFormData,
    formState.componentTypeFormData,
    formState.initialTraitFormDataMap,
    formState.traitFormDataMap,
  );

  // Calculate override states
  const currentOverrides = calculateHasOverrides(
    formState.componentTypeFormData,
    formState.traitFormDataMap,
  );
  const initialOverrides = calculateHasOverrides(
    formState.initialComponentTypeFormData,
    formState.initialTraitFormDataMap,
  );

  const handleSaveClick = () => {
    const totalChanges =
      changes.component.length +
      Object.values(changes.traits).reduce(
        (sum, traitChanges) => sum + traitChanges.length,
        0,
      );

    if (totalChanges === 0) {
      setSaveError('No changes to save');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!environment) return;

    setSaving(true);
    setSaveError(null);

    try {
      await patchReleaseBindingOverrides(
        entity,
        discovery,
        identityApi,
        environment.name.toLowerCase(),
        formState.componentTypeFormData,
        formState.traitFormDataMap,
      );

      setShowSaveConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save overrides',
      );
      setShowSaveConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (target: 'all' | 'component' | string) => {
    setDeleteTarget(target);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!environment || !deleteTarget) return;

    setDeleting(true);
    setSaveError(null);

    try {
      if (deleteTarget === 'all') {
        await patchReleaseBindingOverrides(
          entity,
          discovery,
          identityApi,
          environment.name.toLowerCase(),
          {},
          {},
        );
        setShowDeleteConfirm(false);
        onSaved();
        onClose();
      } else if (deleteTarget === 'component') {
        setComponentTypeFormData({});
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        // Delete specific trait overrides
        setTraitFormDataMap(prev => {
          const newMap = { ...prev };
          delete newMap[deleteTarget];
          return newMap;
        });
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to delete overrides',
      );
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const hasSchemas =
    schemas.componentTypeSchema ||
    Object.keys(schemas.traitSchemasMap).length > 0;

  return (
    <>
      <Dialog
        open={open && !showSaveConfirm && !showDeleteConfirm}
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Configure Overrides - {environment?.name}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers className={classes.dialogContent}>
          {loading && (
            <div className={classes.loadingContainer}>
              <CircularProgress />
            </div>
          )}

          {error && !loading && (
            <div className={classes.errorContainer}>
              <Typography color="error">{error}</Typography>
              <Button onClick={reload} variant="outlined">
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && hasSchemas && (
            <>
              {!currentOverrides.hasAny && (
                <Box className={classes.helpText}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Environment Overrides</strong>
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Configure environment-specific settings for your component's
                    containers, such as environment variables and file mounts.
                    These overrides apply only to the{' '}
                    <strong>{environment?.name}</strong> environment.
                  </Typography>
                </Box>
              )}

              <Box>
                {schemas.componentTypeSchema && (
                  <OverrideSection
                    title="Component Overrides"
                    subtitle="Base component configuration"
                    schema={schemas.componentTypeSchema}
                    formData={formState.componentTypeFormData}
                    onChange={setComponentTypeFormData}
                    onDelete={() => handleDeleteClick('component')}
                    hasInitialData={initialOverrides.hasComponentOverrides}
                    expanded={expandedSections.component ?? false}
                    onToggle={() =>
                      setExpandedSections(prev => ({
                        ...prev,
                        component: !prev.component,
                      }))
                    }
                  />
                )}

                {Object.entries(schemas.traitSchemasMap).map(
                  ([traitName, traitSchema]) => (
                    <OverrideSection
                      key={traitName}
                      title={`Trait: ${traitName}`}
                      subtitle={`${traitName} trait configuration`}
                      schema={traitSchema}
                      formData={formState.traitFormDataMap[traitName] || {}}
                      onChange={newData =>
                        setTraitFormDataMap(prev => ({
                          ...prev,
                          [traitName]: newData,
                        }))
                      }
                      onDelete={() => handleDeleteClick(traitName)}
                      hasInitialData={
                        !!formState.initialTraitFormDataMap[traitName] &&
                        Object.keys(
                          formState.initialTraitFormDataMap[traitName],
                        ).length > 0
                      }
                      expanded={expandedSections[`trait-${traitName}`] ?? false}
                      onToggle={() =>
                        setExpandedSections(prev => ({
                          ...prev,
                          [`trait-${traitName}`]: !prev[`trait-${traitName}`],
                        }))
                      }
                    />
                  ),
                )}

                {Object.keys(schemas.traitSchemasMap).length === 0 &&
                  schemas.componentTypeSchema && (
                    <Box
                      mt={2}
                      p={2}
                      style={{
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                      }}
                    >
                      <Typography variant="body2" color="textSecondary">
                        No traits configured for this component.
                      </Typography>
                    </Box>
                  )}
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions>
          {!showDeleteConfirm && !showSaveConfirm && (
            <Box display="flex" justifyContent="space-between" width="100%">
              <Button
                onClick={() => handleDeleteClick('all')}
                color="secondary"
                disabled={
                  deleting || saving || loading || !initialOverrides.hasAny
                }
              >
                Delete All Overrides
              </Button>
              <Box>
                <Button onClick={onClose} disabled={saving || deleting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveClick}
                  variant="contained"
                  color="primary"
                  disabled={saving || deleting || loading || !!error}
                  style={{ marginLeft: 8 }}
                >
                  Save Overrides
                </Button>
              </Box>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      <SaveConfirmationDialog
        open={showSaveConfirm}
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={handleConfirmSave}
        changes={changes}
        environmentName={environment?.name || ''}
        saving={saving}
      />

      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        deleteTarget={deleteTarget}
        initialComponentTypeFormData={formState.initialComponentTypeFormData}
        initialTraitFormDataMap={formState.initialTraitFormDataMap}
        deleting={deleting}
      />
    </>
  );
};
