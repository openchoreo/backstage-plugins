import { useEffect, useState, useCallback } from 'react';
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
import { JSONSchema7 } from 'json-schema';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  fetchComponentReleaseSchema,
  fetchReleaseBindings,
  patchReleaseBindingOverrides,
} from '../../api/environments';
import { fetchWorkloadInfo } from '../../api/workloadInfo';
import { makeStyles } from '@material-ui/core/styles';
import { OverrideSection } from './OverrideSection';
import { useOverrideChanges } from './hooks/useOverrideChanges';
import { SaveConfirmationDialog } from './SaveConfirmationDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { ContainerSection } from './Workload/WorkloadEditor/ContainerSection';
import { WorkloadProvider } from './Workload/WorkloadContext';

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

interface ReleaseBinding {
  name: string;
  environment: string;
  componentTypeEnvOverrides?: any;
  traitOverrides?: any;
  workloadOverrides?: {
    containers?: { [key: string]: any };
  };
}

export const EnvironmentOverridesDialog: React.FC<
  EnvironmentOverridesDialogProps
> = ({ open, onClose, environment, entity, onSaved }) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    'all' | 'component' | string | null
  >(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate state for component-type and trait overrides
  const [componentTypeSchema, setComponentTypeSchema] =
    useState<JSONSchema7 | null>(null);
  const [traitSchemasMap, setTraitSchemasMap] = useState<
    Record<string, JSONSchema7>
  >({});
  const [componentTypeFormData, setComponentTypeFormData] = useState<any>({});
  const [traitFormDataMap, setTraitFormDataMap] = useState<Record<string, any>>(
    {},
  );
  const [initialComponentTypeFormData, setInitialComponentTypeFormData] =
    useState<any>({});
  const [initialTraitFormDataMap, setInitialTraitFormDataMap] = useState<
    Record<string, any>
  >({});

  // Workload overrides state
  const [workloadFormData, setWorkloadFormData] = useState<any>({});
  const [initialWorkloadFormData, setInitialWorkloadFormData] = useState<any>({});

  // Accordion state
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    component: true,
    workload: false,
  });

  const loadSchemaAndBinding = useCallback(async () => {
    if (!environment?.deployment.releaseName) {
      setError('No release deployed to this environment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch schema for the release
      const schemaResponse = await fetchComponentReleaseSchema(
        entity,
        discovery,
        identityApi,
        environment.deployment.releaseName,
      );

      if (schemaResponse.success && schemaResponse.data) {
        // The API returns a wrapped schema with properties
        // Extract componentTypeEnvOverrides and traitOverrides from properties
        const wrappedSchema = schemaResponse.data as any;
        const componentTypeEnvOverrides =
          wrappedSchema.properties?.componentTypeEnvOverrides;
        const traitOverrides = wrappedSchema.properties?.traitOverrides;

        // Set component-type schema
        if (componentTypeEnvOverrides) {
          setComponentTypeSchema(componentTypeEnvOverrides as JSONSchema7);
        }

        // Set trait schemas
        if (traitOverrides && traitOverrides.properties) {
          const traitSchemas: Record<string, JSONSchema7> = {};
          Object.entries(traitOverrides.properties).forEach(
            ([traitName, schema]) => {
              traitSchemas[traitName] = schema as JSONSchema7;
            },
          );
          setTraitSchemasMap(traitSchemas);

          // Initialize expanded state for each trait
          const newExpandedSections: Record<string, boolean> = {
            component: true,
            workload: false,
          };
          Object.keys(traitSchemas).forEach(traitName => {
            newExpandedSections[`trait-${traitName}`] = false;
          });
          setExpandedSections(newExpandedSections);
        }
      } else {
        throw new Error('Failed to fetch schema');
      }

      // Fetch existing bindings to get current overrides
      const bindingsResponse = await fetchReleaseBindings(
        entity,
        discovery,
        identityApi,
      );

      if (bindingsResponse.success && bindingsResponse.data?.items) {
        const bindings = bindingsResponse.data.items as ReleaseBinding[];
        const currentBinding = bindings.find(
          b => b.environment.toLowerCase() === environment.name.toLowerCase(),
        );

        if (currentBinding) {
          // Load component-type overrides
          const componentOverrides =
            currentBinding.componentTypeEnvOverrides || {};
          setComponentTypeFormData(componentOverrides);
          setInitialComponentTypeFormData(componentOverrides);

          // Load trait overrides
          const traitOverrides = currentBinding.traitOverrides || {};
          setTraitFormDataMap(traitOverrides);
          setInitialTraitFormDataMap(traitOverrides);

          // Load workload overrides
          const workloadOverrides = currentBinding.workloadOverrides || {};
          
          // If no workload overrides exist, fetch workload info to populate container structure
          if (!workloadOverrides.containers || Object.keys(workloadOverrides.containers).length === 0) {
            const workloadInfo = await fetchWorkloadInfo(entity, discovery, identityApi);
            const populatedWorkloadOverrides = createContainersFromWorkload(workloadInfo);
            if (populatedWorkloadOverrides) {
              setWorkloadFormData(populatedWorkloadOverrides);
              setInitialWorkloadFormData({}); // Keep initial as empty since this is auto-populated
            } else {
              setWorkloadFormData(workloadOverrides);
              setInitialWorkloadFormData(workloadOverrides);
            }
          } else {
            setWorkloadFormData(workloadOverrides);
            setInitialWorkloadFormData(workloadOverrides);
          }
        } else {
          setComponentTypeFormData({});
          setInitialComponentTypeFormData({});
          setTraitFormDataMap({});
          setInitialTraitFormDataMap({});
          setWorkloadFormData({});
          setInitialWorkloadFormData({});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identityApi, environment]);

  useEffect(() => {
    if (open && environment) {
      loadSchemaAndBinding();
    }
  }, [open, environment, loadSchemaAndBinding]);

  // Use the custom hook to calculate changes
  const changes = useOverrideChanges(
    initialComponentTypeFormData,
    componentTypeFormData,
    initialTraitFormDataMap,
    traitFormDataMap,
    initialWorkloadFormData,
    workloadFormData,
  );

  // Helper function to create empty containers structure from workload info
  const createContainersFromWorkload = (workloadInfo: any) => {
    if (workloadInfo?.containers) {
      const containers: any = {};
      Object.keys(workloadInfo.containers).forEach(containerName => {
        containers[containerName] = {
          env: [],
          files: [],
        };
      });
      return { containers };
    }
    return null;
  };

  // Workload container management functions
  const handleContainerChange = (containerName: string, field: string, value: any) => {
    setWorkloadFormData((prev: any) => ({
      ...prev,
      containers: {
        ...prev.containers,
        [containerName]: {
          ...(prev.containers?.[containerName] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleEnvVarChange = (containerName: string, envIndex: number, field: string, value: string) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const env = container.env || [];
      const updatedEnv = [...env];
      if (!updatedEnv[envIndex]) {
        updatedEnv[envIndex] = {};
      }
      updatedEnv[envIndex] = {
        ...updatedEnv[envIndex],
        [field]: value,
      };
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            env: updatedEnv,
          },
        },
      };
    });
  };

  const handleFileVarChange = (containerName: string, fileIndex: number, field: string, value: string) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const files = (container as any).files || [];
      const updatedFiles = [...files];
      if (!updatedFiles[fileIndex]) {
        updatedFiles[fileIndex] = {};
      }
      updatedFiles[fileIndex] = {
        ...updatedFiles[fileIndex],
        [field]: value,
      };
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            files: updatedFiles,
          },
        },
      };
    });
  };

  const handleAddContainer = () => {
    const containerNames = Object.keys(workloadFormData.containers || {});
    const newName = containerNames.length === 0 ? 'main' : `container-${containerNames.length}`;
    setWorkloadFormData((prev: any) => ({
      ...prev,
      containers: {
        ...prev.containers,
        [newName]: {
          image: '',
          env: [],
          files: [],
        },
      },
    }));
  };

  const handleRemoveContainer = (containerName: string) => {
    setWorkloadFormData((prev: any) => {
      const containers = { ...prev.containers };
      delete containers[containerName];
      return {
        ...prev,
        containers,
      };
    });
  };

  const handleAddEnvVar = (containerName: string) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const env = container.env || [];
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            env: [...env, { key: '', value: '' }],
          },
        },
      };
    });
  };

  const handleRemoveEnvVar = (containerName: string, envIndex: number) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const env = container.env || [];
      const updatedEnv = env.filter((_: any, index: number) => index !== envIndex);
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            env: updatedEnv,
          },
        },
      };
    });
  };

  const handleAddFileVar = (containerName: string) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const files = (container as any).files || [];
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            files: [...files, { key: '', mountPath: '', value: '' }],
          },
        },
      };
    });
  };

  const handleRemoveFileVar = (containerName: string, fileIndex: number) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const files = (container as any).files || [];
      const updatedFiles = files.filter((_: any, index: number) => index !== fileIndex);
      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            files: updatedFiles,
          },
        },
      };
    });
  };

  const handleArrayFieldChange = (containerName: string, field: string, value: string) => {
    const arrayValue = value.split(',').map((item: string) => item.trim()).filter((item: string) => item);
    setWorkloadFormData((prev: any) => ({
      ...prev,
      containers: {
        ...prev.containers,
        [containerName]: {
          ...(prev.containers?.[containerName] || {}),
          [field]: arrayValue,
        },
      },
    }));
  };

  const handleSaveClick = () => {
    const totalChanges =
      changes.component.length +
      Object.values(changes.traits).reduce(
        (sum, traitChanges) => sum + traitChanges.length,
        0,
      ) +
      (changes.workload?.length || 0);

    if (totalChanges === 0) {
      setError('No changes to save');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleCancelSave = () => {
    setShowSaveConfirm(false);
  };

  const handleConfirmSave = async () => {
    if (!environment) return;

    setSaving(true);
    setError(null);

    try {
      await patchReleaseBindingOverrides(
        entity,
        discovery,
        identityApi,
        environment.name.toLowerCase(),
        componentTypeFormData,
        traitFormDataMap,
        workloadFormData,
      );

      // Overrides saved successfully, backend will automatically redeploy
      setShowSaveConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save overrides');
      setShowSaveConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (target: 'all' | 'component' | string) => {
    setDeleteTarget(target);
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!environment || !deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      if (deleteTarget === 'all') {
        // Delete all overrides (component + traits + workload)
        await patchReleaseBindingOverrides(
          entity,
          discovery,
          identityApi,
          environment.name.toLowerCase(),
          {},
          {},
          {},
        );

        setShowDeleteConfirm(false);
        onSaved();
        onClose();
      } else if (deleteTarget === 'component') {
        // Delete only component-type overrides
        setComponentTypeFormData({});
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else if (deleteTarget === 'workload') {
        // Delete only workload overrides
        setWorkloadFormData({});
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        // Delete specific trait overrides
        const newTraitFormDataMap = { ...traitFormDataMap };
        delete newTraitFormDataMap[deleteTarget];
        setTraitFormDataMap(newTraitFormDataMap);
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete overrides',
      );
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const hasComponentTypeOverrides =
    componentTypeFormData && Object.keys(componentTypeFormData).length > 0;
  const hasAnyTraitOverrides = Object.values(traitFormDataMap).some(
    data => Object.keys(data).length > 0,
  );
  const hasWorkloadOverrides =
    workloadFormData && Object.keys(workloadFormData).length > 0;
  const hasAnyOverrides = hasComponentTypeOverrides || hasAnyTraitOverrides || hasWorkloadOverrides;

  const hasInitialComponentTypeOverrides =
    initialComponentTypeFormData &&
    Object.keys(initialComponentTypeFormData).length > 0;
  const hasInitialAnyTraitOverrides = Object.values(
    initialTraitFormDataMap,
  ).some(data => Object.keys(data).length > 0);
  const hasInitialWorkloadOverrides =
    initialWorkloadFormData &&
    Object.keys(initialWorkloadFormData).length > 0;
  const hasInitialAnyOverrides =
    hasInitialComponentTypeOverrides || hasInitialAnyTraitOverrides || hasInitialWorkloadOverrides;

  const renderDialogContent = () => {
    // Confirmation dialogs are now separate components, not rendered here
    return (
      <>
        {loading && (
          <div className={classes.loadingContainer}>
            <CircularProgress />
          </div>
        )}

        {error && !loading && (
          <div className={classes.errorContainer}>
            <Typography color="error">{error}</Typography>
            <Button onClick={loadSchemaAndBinding} variant="outlined">
              Retry
            </Button>
          </div>
        )}

        {!loading &&
          !error &&
          (componentTypeSchema || Object.keys(traitSchemasMap).length > 0) && (
            <>
              {!hasAnyOverrides && (
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
                {/* Component Overrides Section */}
                {componentTypeSchema && (
                  <OverrideSection
                    title="Component Overrides"
                    subtitle="Base component configuration"
                    schema={componentTypeSchema}
                    formData={componentTypeFormData}
                    onChange={setComponentTypeFormData}
                    onDelete={() => handleDeleteClick('component')}
                    hasInitialData={hasInitialComponentTypeOverrides}
                    expanded={expandedSections.component ?? false}
                    onToggle={() =>
                      setExpandedSections(prev => ({
                        ...prev,
                        component: !prev.component,
                      }))
                    }
                  />
                )}

                {/* Trait Overrides Sections */}
                {Object.entries(traitSchemasMap).map(
                  ([traitName, traitSchema]) => (
                    <OverrideSection
                      key={traitName}
                      title={`Trait: ${traitName}`}
                      subtitle={`${traitName} trait configuration`}
                      schema={traitSchema}
                      formData={traitFormDataMap[traitName] || {}}
                      onChange={newData =>
                        setTraitFormDataMap(prev => ({
                          ...prev,
                          [traitName]: newData,
                        }))
                      }
                      onDelete={() => handleDeleteClick(traitName)}
                      hasInitialData={
                        initialTraitFormDataMap[traitName] &&
                        Object.keys(initialTraitFormDataMap[traitName]).length >
                          0
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

                {/* Workload Overrides Section */}
                <OverrideSection
                  title="Workload Overrides"
                  subtitle="Container overrides"
                  schema={null} // No JSON schema for workload overrides
                  formData={workloadFormData}
                  onChange={setWorkloadFormData}
                  onDelete={() => handleDeleteClick('workload')}
                  hasInitialData={hasInitialWorkloadOverrides}
                  expanded={expandedSections.workload ?? false}
                  onToggle={() =>
                    setExpandedSections(prev => ({
                      ...prev,
                      workload: !prev.workload,
                    }))
                  }
                  customContent={
                    <WorkloadProvider
                      builds={[]}
                      workloadSpec={null}
                      setWorkloadSpec={() => {}}
                      isDeploying={false}
                    >
                      <ContainerSection
                        containers={workloadFormData.containers || {}}
                        onContainerChange={handleContainerChange}
                        onEnvVarChange={handleEnvVarChange}
                        onFileVarChange={handleFileVarChange}
                        onAddContainer={handleAddContainer}
                        onRemoveContainer={handleRemoveContainer}
                        onAddEnvVar={handleAddEnvVar}
                        onRemoveEnvVar={handleRemoveEnvVar}
                        onAddFileVar={handleAddFileVar}
                        onRemoveFileVar={handleRemoveFileVar}
                        onArrayFieldChange={handleArrayFieldChange}
                        disabled={saving || deleting || loading}
                        singleContainerMode={true}
                        hideContainerFields={true}
                    />
                    </WorkloadProvider>
                  }
                />

                {/* Empty State - No Traits */}
                {Object.keys(traitSchemasMap).length === 0 &&
                  componentTypeSchema && (
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
      </>
    );
  };

  const renderDialogActions = () => {
    // Show actions only when not in confirmation mode
    if (showDeleteConfirm || showSaveConfirm) {
      return null;
    }

    return (
      <Box display="flex" justifyContent="space-between" width="100%">
        <Button
          onClick={() => handleDeleteClick('all')}
          color="secondary"
          disabled={deleting || saving || loading || !hasInitialAnyOverrides}
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
    );
  };

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
          {renderDialogContent()}
        </DialogContent>

        <DialogActions>{renderDialogActions()}</DialogActions>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <SaveConfirmationDialog
        open={showSaveConfirm}
        onCancel={handleCancelSave}
        onConfirm={handleConfirmSave}
        changes={changes}
        environmentName={environment?.name || ''}
        saving={saving}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        deleteTarget={deleteTarget}
        initialComponentTypeFormData={initialComponentTypeFormData}
        initialTraitFormDataMap={initialTraitFormDataMap}
        deleting={deleting}
      />
    </>
  );
};
