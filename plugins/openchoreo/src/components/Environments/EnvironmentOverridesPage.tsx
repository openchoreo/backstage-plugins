import { useState, useMemo, useEffect } from 'react';
import { Box, Button, Typography, CircularProgress } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { makeStyles } from '@material-ui/core/styles';
import { OverrideContent } from './OverrideContent';
import { useOverrideChanges } from './hooks/useOverrideChanges';
import { useOverridesData } from './hooks/useOverridesData';
import { SaveConfirmationDialog } from './SaveConfirmationDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import {
  UnsavedChangesDialog,
  useUrlSyncedTab,
  DetailPageLayout,
} from '@openchoreo/backstage-plugin-react';
import {
  calculateHasOverrides,
  getMissingRequiredFields,
} from './overridesUtils';
import type { Environment } from './hooks/useEnvironmentData';
import type { PendingAction } from './types';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import WidgetsIcon from '@material-ui/icons/Widgets';
import SettingsIcon from '@material-ui/icons/Settings';
import ExtensionIcon from '@material-ui/icons/Extension';
import { ContainerContent } from './Workload/WorkloadEditor';
import { useSecretReferences } from '@openchoreo/backstage-plugin-react';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import { TraitParameters } from './TraitParameters';

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
    gap: theme.spacing(2),
  },
  helpText: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  tabNav: {
    height: '100%',
    minHeight: 400,
  },
}));

interface EnvironmentOverridesPageProps {
  environment: Environment;
  entity: Entity;
  onBack: () => void;
  onSaved: () => void;
  /** Pending action to execute after saving overrides */
  pendingAction?: PendingAction;
  /** Callback when overrides are saved and pending action should be executed */
  onPendingActionComplete?: (action: PendingAction) => Promise<void>;
  /** Callback when Previous button is clicked (only shown when pendingAction exists) */
  onPrevious?: () => void;
  /** Initial tab to display (from URL) */
  initialTab?: string;
  /** Callback when tab changes (to update URL). Second param is replace (default false). */
  onTabChange?: (tabId: string, replace?: boolean) => void;
}

export const EnvironmentOverridesPage = ({
  environment,
  entity,
  onBack,
  onSaved,
  pendingAction,
  onPendingActionComplete,
  onPrevious,
  initialTab,
  onTabChange,
}: EnvironmentOverridesPageProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);

  const [traitTypeMap, setTraitTypeMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    'all' | 'component' | string | null
  >(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load secret references for workload overrides
  const { secretReferences } = useSecretReferences();

  // Fetch component traits to get trait type information
  useEffect(() => {
    const fetchTraitTypes = async () => {
      try {
        const traits = await client.fetchComponentTraits(entity);
        const typeMap: Record<string, string> = {};
        traits.forEach(trait => {
          typeMap[trait.instanceName] = trait.name;
        });
        setTraitTypeMap(typeMap);
      } catch (err) {
        // Silently fail - trait types are nice to have but not critical
      }
    };
    fetchTraitTypes();
  }, [client, entity]);

  // Use pendingAction release name when promoting/deploying, otherwise use environment's release
  const releaseNameForOverrides =
    pendingAction?.releaseName || environment.deployment.releaseName;

  // Load data using custom hook
  const {
    loading,
    error: loadError,
    schemas,
    formState,
    setComponentTypeFormData,
    setTraitFormDataMap,
    setWorkloadFormData,
    reload,
  } = useOverridesData(
    entity,
    environment.name,
    releaseNameForOverrides,
    true, // always open
  );

  const error = loadError || saveError;

  // Calculate changes
  const changes = useOverrideChanges(
    formState.initialComponentTypeFormData,
    formState.componentTypeFormData,
    formState.initialTraitFormDataMap,
    formState.traitFormDataMap,
    formState.initialWorkloadFormData,
    formState.workloadFormData,
  );

  // Calculate override states
  const currentOverrides = calculateHasOverrides(
    formState.componentTypeFormData,
    formState.traitFormDataMap,
    formState.workloadFormData,
  );
  const initialOverrides = calculateHasOverrides(
    formState.initialComponentTypeFormData,
    formState.initialTraitFormDataMap,
    formState.initialWorkloadFormData,
  );

  // Calculate missing required fields for validation
  const missingRequiredFields = useMemo(() => {
    if (!schemas.componentTypeSchema) {
      return [];
    }
    return getMissingRequiredFields(
      schemas.componentTypeSchema,
      formState.componentTypeFormData,
    );
  }, [schemas.componentTypeSchema, formState.componentTypeFormData]);

  // Helper function to determine tab status with priority: error > info > success > undefined
  const getTabStatus = (
    hasInitialData: boolean,
    hasChanges: boolean,
    hasMissingRequired: boolean,
  ): TabItemData['status'] => {
    if (hasMissingRequired) return 'error';
    if (hasChanges) return 'info';
    if (hasInitialData) return 'success';
    return undefined;
  };

  // Build tabs from available schemas
  const tabs = useMemo<TabItemData[]>(() => {
    const tabList: TabItemData[] = [];

    // Add Component Overrides tab if schema exists
    if (schemas.componentTypeSchema) {
      // Use hasActualComponentOverrides to check if backend has real overrides (not just defaults)
      const hasInitialComponentData = formState.hasActualComponentOverrides;
      const hasComponentChanges = changes.component.length > 0;
      const hasMissingComponentRequired = missingRequiredFields.length > 0;

      tabList.push({
        id: 'component',
        label: 'Component',
        icon: <WidgetsIcon />,
        status: getTabStatus(
          hasInitialComponentData,
          hasComponentChanges,
          hasMissingComponentRequired,
        ),
      });
    }

    // Add Workload tab
    // Use hasActualWorkloadOverrides to check if backend has real overrides
    const hasInitialWorkloadData = formState.hasActualWorkloadOverrides;
    const hasWorkloadChanges = (changes.workload?.length || 0) > 0;
    // Workload doesn't use JSON schema, so no required field validation
    tabList.push({
      id: 'workload',
      label: 'Workload',
      icon: <SettingsIcon />,
      status: getTabStatus(hasInitialWorkloadData, hasWorkloadChanges, false),
    });

    // Build trait child tabs
    const traitTabs: TabItemData[] = [];
    Object.keys(schemas.traitSchemasMap).forEach(traitName => {
      const traitSchema = schemas.traitSchemasMap[traitName];
      // Use hasActualTraitOverridesMap to check if backend has real overrides for this trait
      const hasInitialTraitData =
        formState.hasActualTraitOverridesMap[traitName] || false;
      const hasTraitChanges = (changes.traits[traitName]?.length || 0) > 0;
      const traitMissingRequired = getMissingRequiredFields(
        traitSchema,
        formState.traitFormDataMap[traitName],
      );

      traitTabs.push({
        id: `trait-${traitName}`,
        label: traitName,
        // icon: <ExtensionIcon />,
        status: getTabStatus(
          hasInitialTraitData,
          hasTraitChanges,
          traitMissingRequired.length > 0,
        ),
      });
    });

    // Add Traits group if there are any trait tabs
    if (traitTabs.length > 0) {
      // Aggregate status from child traits - prioritize error > info > success
      let aggregatedStatus: TabItemData['status'] = undefined;
      if (traitTabs.some(t => t.status === 'error')) {
        aggregatedStatus = 'error';
      } else if (traitTabs.some(t => t.status === 'info')) {
        aggregatedStatus = 'info';
      } else if (traitTabs.some(t => t.status === 'success')) {
        aggregatedStatus = 'success';
      }

      tabList.push({
        id: 'traits-group',
        label: 'Traits',
        icon: <ExtensionIcon />,
        isGroup: true,
        children: traitTabs,
        status: aggregatedStatus,
      });
    }

    return tabList;
  }, [
    schemas,
    formState.hasActualComponentOverrides,
    formState.hasActualTraitOverridesMap,
    formState.hasActualWorkloadOverrides,
    formState.traitFormDataMap,
    changes,
    missingRequiredFields,
  ]);

  // Tab state with URL sync
  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: '',
    onTabChange,
  });

  // Set default active tab when tabs are loaded
  useEffect(() => {
    // baseWorkloadData is only set after initial load completes (null until then)
    if (
      !loading &&
      formState.baseWorkloadData &&
      tabs.length > 0 &&
      !activeTab
    ) {
      const defaultTab = tabs[0].id;
      // Use replace: true to avoid adding to history when auto-setting default tab
      setActiveTab(defaultTab, true);
    }
  }, [loading, formState.baseWorkloadData, tabs, activeTab, setActiveTab]);

  // Workload container management functions
  const handleContainerChange = (
    containerName: string,
    field: string,
    value: any,
  ) => {
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

  const handleEnvVarChange = (
    containerName: string,
    envIndex: number,
    field: string,
    value: string,
  ) => {
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

  const handleEnvVarReplace = (
    containerName: string,
    envIndex: number,
    envVar: EnvVar,
  ) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const env = container.env || [];
      const updatedEnv = [...env];
      updatedEnv[envIndex] = envVar;
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

  const handleFileVarChange = (
    containerName: string,
    fileIndex: number,
    field: string,
    value: string,
  ) => {
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
    const containerNames = Object.keys(
      formState.workloadFormData.containers || {},
    );
    const newName =
      containerNames.length === 0
        ? 'main'
        : `container-${containerNames.length}`;
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
      const updatedEnv = env.filter(
        (_: any, index: number) => index !== envIndex,
      );
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
      const updatedFiles = files.filter(
        (_: any, index: number) => index !== fileIndex,
      );
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

  const handleArrayFieldChange = (
    containerName: string,
    field: string,
    value: string,
  ) => {
    const arrayValue = value
      .split(',')
      .map((item: string) => item.trim())
      .filter((item: string) => item);
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

  // Handle starting override of an inherited env var
  const handleStartOverride = (containerName: string, envVar: EnvVar) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const existingEnv = container.env || [];

      // Check if already overridden
      if (existingEnv.some((e: EnvVar) => e.key === envVar.key)) {
        return prev;
      }

      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            env: [...existingEnv, { ...envVar }],
          },
        },
      };
    });
  };

  // Handle starting override of an inherited file var
  const handleStartFileOverride = (
    containerName: string,
    fileVar: import('@openchoreo/backstage-plugin-common').FileVar,
  ) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const existingFiles = (container as any).files || [];

      // Check if already overridden
      if (
        existingFiles.some(
          (f: import('@openchoreo/backstage-plugin-common').FileVar) =>
            f.key === fileVar.key,
        )
      ) {
        return prev;
      }

      return {
        ...prev,
        containers: {
          ...containers,
          [containerName]: {
            ...container,
            files: [...existingFiles, { ...fileVar }],
          },
        },
      };
    });
  };

  // Handle replacing an entire file var at once (atomic update)
  const handleFileVarReplace = (
    containerName: string,
    fileIndex: number,
    fileVar: import('@openchoreo/backstage-plugin-common').FileVar,
  ) => {
    setWorkloadFormData((prev: any) => {
      const containers = prev.containers || {};
      const container = containers[containerName] || {};
      const files = (container as any).files || [];
      const updatedFiles = [...files];
      updatedFiles[fileIndex] = fileVar;
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

  // Calculate if there are any changes
  const totalChanges =
    changes.component.length +
    Object.values(changes.traits).reduce(
      (sum, traitChanges) => sum + traitChanges.length,
      0,
    ) +
    (changes.workload?.length || 0);

  const handleSaveClick = async () => {
    // Allow skip when pendingAction exists but no changes
    if (totalChanges === 0 && pendingAction && onPendingActionComplete) {
      setSaving(true);
      try {
        await onPendingActionComplete(pendingAction);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to deploy');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (totalChanges === 0) {
      setSaveError('No changes to save');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await client.patchReleaseBindingOverrides(
        entity,
        environment.name.toLowerCase(),
        formState.componentTypeFormData,
        formState.traitFormDataMap,
        formState.workloadFormData,
        pendingAction?.releaseName,
      );

      setShowSaveConfirm(false);

      // If there's a pending action, execute it after saving
      if (pendingAction && onPendingActionComplete) {
        await onPendingActionComplete(pendingAction);
        // onPendingActionComplete handles navigation
      } else {
        onSaved();
        onBack();
      }
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
    if (!deleteTarget) return;

    setDeleting(true);
    setSaveError(null);

    try {
      if (deleteTarget === 'all') {
        await client.patchReleaseBindingOverrides(
          entity,
          environment.name.toLowerCase(),
          {},
          {},
          {},
        );
        setShowDeleteConfirm(false);
        onSaved();
        onBack();
      } else if (deleteTarget === 'component') {
        setComponentTypeFormData({});
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else if (deleteTarget === 'workload') {
        setWorkloadFormData({});
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

  // Handle back button click with unsaved changes warning
  const handleBackClick = () => {
    if (totalChanges > 0) {
      setShowUnsavedChangesDialog(true);
    } else {
      onBack();
    }
  };

  // Determine button text based on pending action and changes
  const getSaveButtonText = () => {
    if (saving) {
      if (pendingAction?.type === 'deploy') return 'Deploying...';
      if (pendingAction?.type === 'promote') return 'Promoting...';
      return 'Saving...';
    }

    if (pendingAction) {
      const hasChanges = totalChanges > 0;
      if (pendingAction.type === 'deploy') {
        return hasChanges ? 'Save & Deploy' : 'Deploy';
      }
      if (pendingAction.type === 'promote') {
        return hasChanges ? 'Save & Promote' : 'Promote';
      }
    }

    return 'Save Overrides';
  };

  // Get the warning message for missing required fields
  const getRequiredFieldsWarningMessage = () => {
    if (!pendingAction) {
      return 'Please fill in the required fields below before saving.';
    }
    if (pendingAction.type === 'deploy') {
      return `Please fill in the required fields below before deploying to ${pendingAction.targetEnvironment}.`;
    }
    return `Please fill in the required fields below before promoting to ${pendingAction.targetEnvironment}.`;
  };

  // Header actions - show when schemas exist OR when there's a pending action (for Skip & Deploy)
  const showActions = !loading && !error && (hasSchemas || pendingAction);
  const headerActions = showActions ? (
    <>
      {!pendingAction && (
        <Button
          onClick={() => handleDeleteClick('all')}
          color="secondary"
          disabled={deleting || saving || loading || !initialOverrides.hasAny}
        >
          Delete All
        </Button>
      )}
      {pendingAction && onPrevious && (
        <Button
          onClick={onPrevious}
          variant="outlined"
          disabled={saving || deleting}
          style={{ marginRight: 8 }}
        >
          Previous
        </Button>
      )}
      <Button
        onClick={handleSaveClick}
        variant="contained"
        color="primary"
        disabled={
          saving ||
          deleting ||
          loading ||
          !!error ||
          missingRequiredFields.length > 0 ||
          (!pendingAction && totalChanges === 0)
        }
      >
        {getSaveButtonText()}
      </Button>
    </>
  ) : null;

  // Render content for active tab
  const renderTabContent = () => {
    if (activeTab === 'component' && schemas.componentTypeSchema) {
      return (
        <OverrideContent
          title="Component Overrides"
          schema={schemas.componentTypeSchema}
          formData={formState.componentTypeFormData}
          onChange={setComponentTypeFormData}
          onDelete={() => handleDeleteClick('component')}
          hasInitialData={initialOverrides.hasComponentOverrides}
          disabled={saving || deleting}
          showValidation
        />
      );
    }

    // Check for trait tabs
    if (activeTab.startsWith('trait-')) {
      const traitName = activeTab.replace('trait-', '');
      const traitSchema = schemas.traitSchemasMap[traitName];
      if (traitSchema) {
        // Get trait type from the map, fallback to generic "Trait" if not found
        const traitType = traitTypeMap[traitName] || 'trait';

        return (
          <OverrideContent
            title={`${traitName} Trait`}
            contentTitle={
              <>
                <Box display="flex" alignItems="center" gridGap={4} mb={4}>
                  <Typography variant="h4">{traitName}</Typography>
                  <Typography variant="h4" color="textSecondary">
                    ({traitType})
                  </Typography>
                </Box>
                <TraitParameters
                  entity={entity}
                  traitInstanceName={traitName}
                />
              </>
            }
            sectionTitle={
              <Box mb={2}>
                <Typography variant="h5" gutterBottom>
                  Overrides
                </Typography>
              </Box>
            }
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
              Object.keys(formState.initialTraitFormDataMap[traitName]).length >
                0
            }
            disabled={saving || deleting}
            showValidation
          />
        );
      }
    }

    if (activeTab === 'workload') {
      return (
        <OverrideContent
          title="Workload Overrides"
          schema={null} // No JSON schema for workload overrides
          formData={formState.workloadFormData}
          onChange={setWorkloadFormData}
          onDelete={() => handleDeleteClick('workload')}
          hasInitialData={initialOverrides.hasWorkloadOverrides}
          customContent={
            <ContainerContent
              containers={formState.workloadFormData.containers || {}}
              onContainerChange={handleContainerChange}
              onEnvVarChange={handleEnvVarChange}
              onEnvVarReplace={handleEnvVarReplace}
              onFileVarChange={handleFileVarChange}
              onFileVarReplace={handleFileVarReplace}
              onAddContainer={handleAddContainer}
              onRemoveContainer={handleRemoveContainer}
              onAddEnvVar={handleAddEnvVar}
              onRemoveEnvVar={handleRemoveEnvVar}
              onAddFileVar={handleAddFileVar}
              onRemoveFileVar={handleRemoveFileVar}
              onArrayFieldChange={handleArrayFieldChange}
              disabled={saving || deleting || loading}
              singleContainerMode
              hideContainerFields
              secretReferences={secretReferences}
              baseWorkloadData={formState.baseWorkloadData}
              showEnvVarStatus
              onStartOverride={handleStartOverride}
              onStartFileOverride={handleStartFileOverride}
              environmentName={environment.name}
            />
          }
        />
      );
    }

    return null;
  };

  return (
    <>
      <DetailPageLayout
        title={
          pendingAction && missingRequiredFields.length > 0
            ? 'Configure Required Overrides'
            : 'Configure Overrides'
        }
        subtitle={environment.name}
        onBack={handleBackClick}
        actions={headerActions}
      >
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

        {!loading && !error && !hasSchemas && pendingAction && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight={300}
            p={4}
          >
            <Typography variant="h6" gutterBottom>
              No Configuration Required
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              style={{ marginBottom: 24 }}
            >
              This component has no environment-specific overrides to configure.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveClick}
              disabled={saving}
            >
              {getSaveButtonText()}
            </Button>
          </Box>
        )}

        {!loading && !error && hasSchemas && (
          <>
            {missingRequiredFields.length > 0 && (
              <Box mb={2}>
                <Alert severity="warning">
                  <strong>Required configuration needed.</strong>{' '}
                  {getRequiredFieldsWarningMessage()}
                </Alert>
              </Box>
            )}

            {!currentOverrides.hasAny && !pendingAction && (
              <Box className={classes.helpText}>
                <Typography variant="body2" gutterBottom>
                  <strong>Environment Overrides</strong>
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Configure environment-specific settings for your component's
                  containers, such as environment variables and file mounts.
                  These overrides apply only to the{' '}
                  <strong>{environment.name}</strong> environment.
                </Typography>
              </Box>
            )}

            {tabs.length > 0 && (
              <VerticalTabNav
                tabs={tabs}
                activeTabId={activeTab}
                onChange={setActiveTab}
                className={classes.tabNav}
              >
                {renderTabContent()}
              </VerticalTabNav>
            )}

            {tabs.length === 0 && (
              <Box
                p={2}
                style={{
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                }}
              >
                <Typography variant="body2" color="textSecondary">
                  No configuration options available for this component.
                </Typography>
              </Box>
            )}
          </>
        )}
      </DetailPageLayout>

      <SaveConfirmationDialog
        open={showSaveConfirm}
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={handleConfirmSave}
        changes={changes}
        environmentName={environment.name}
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

      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        onDiscard={() => {
          setShowUnsavedChangesDialog(false);
          onBack();
        }}
        onStay={() => setShowUnsavedChangesDialog(false)}
        changeCount={totalChanges}
      />
    </>
  );
};
