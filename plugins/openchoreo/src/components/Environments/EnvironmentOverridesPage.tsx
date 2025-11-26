import { useState, useMemo } from 'react';
import { Box, Button, Typography, CircularProgress } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { patchReleaseBindingOverrides } from '../../api/environments';
import { makeStyles } from '@material-ui/core/styles';
import { OverrideContent } from './OverrideContent';
import { useOverrideChanges } from './hooks/useOverrideChanges';
import { useOverridesData } from './hooks/useOverridesData';
import { SaveConfirmationDialog } from './SaveConfirmationDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { calculateHasOverrides } from './overridesUtils';
import { DetailPageLayout } from './components/DetailPageLayout';
import type { Environment } from './hooks/useEnvironmentData';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import SettingsIcon from '@material-ui/icons/Settings';
import ExtensionIcon from '@material-ui/icons/Extension';
import { ContainerSection } from './Workload/WorkloadEditor/ContainerSection';
import { WorkloadProvider } from './Workload/WorkloadContext';

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
}

export const EnvironmentOverridesPage = ({
  environment,
  entity,
  onBack,
  onSaved,
}: EnvironmentOverridesPageProps) => {
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
    setComponentTypeFormData,
    setTraitFormDataMap,
    setWorkloadFormData,
    reload,
  } = useOverridesData(
    entity,
    discovery,
    identityApi,
    environment.name,
    environment.deployment.releaseName,
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

  // Build tabs from available schemas
  const tabs = useMemo<TabItemData[]>(() => {
    const tabList: TabItemData[] = [];

    // Add Component Overrides tab if schema exists
    if (schemas.componentTypeSchema) {
      const hasComponentData =
        formState.componentTypeFormData &&
        Object.keys(formState.componentTypeFormData).length > 0;
      tabList.push({
        id: 'component',
        label: 'Component',
        icon: <SettingsIcon />,
        status: hasComponentData ? 'success' : undefined,
      });
    }

    // Add trait tabs
    Object.keys(schemas.traitSchemasMap).forEach(traitName => {
      const hasTraitData =
        formState.traitFormDataMap[traitName] &&
        Object.keys(formState.traitFormDataMap[traitName]).length > 0;
      tabList.push({
        id: `trait-${traitName}`,
        label: traitName,
        icon: <ExtensionIcon />,
        status: hasTraitData ? 'success' : undefined,
      });
    });

    // Add Workload tab
    const hasWorkloadData =
      formState.workloadFormData &&
      Object.keys(formState.workloadFormData).length > 0;
    tabList.push({
      id: 'workload',
      label: 'Workload',
      icon: <ExtensionIcon />,
      status: hasWorkloadData ? 'success' : undefined,
    });

    return tabList;
  }, [schemas, formState.componentTypeFormData, formState.traitFormDataMap, formState.workloadFormData]);

  // Set initial active tab
  const [activeTab, setActiveTab] = useState<string>('');

  // Set default active tab when tabs are loaded
  useMemo(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

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

  const handleSaveClick = () => {
    const totalChanges =
      changes.component.length +
      Object.values(changes.traits).reduce(
        (sum, traitChanges) => sum + traitChanges.length,
        0,
      ) +
      (changes.workload?.length || 0);

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
      await patchReleaseBindingOverrides(
        entity,
        discovery,
        identityApi,
        environment.name.toLowerCase(),
        formState.componentTypeFormData,
        formState.traitFormDataMap,
        formState.workloadFormData,
      );

      setShowSaveConfirm(false);
      onSaved();
      onBack();
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

  // Header actions - moved from footer
  const headerActions =
    !loading && !error && hasSchemas ? (
      <>
        <Button
          onClick={() => handleDeleteClick('all')}
          color="secondary"
          disabled={deleting || saving || loading || !initialOverrides.hasAny}
        >
          Delete All
        </Button>
        <Button
          onClick={handleSaveClick}
          variant="contained"
          color="primary"
          disabled={saving || deleting || loading || !!error}
        >
          {saving ? 'Saving...' : 'Save Overrides'}
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
        />
      );
    }

    // Check for trait tabs
    if (activeTab.startsWith('trait-')) {
      const traitName = activeTab.replace('trait-', '');
      const traitSchema = schemas.traitSchemasMap[traitName];
      if (traitSchema) {
        return (
          <OverrideContent
            title={`${traitName} Trait`}
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
            <WorkloadProvider
              builds={[]}
              workloadSpec={null}
              setWorkloadSpec={() => {}}
              isDeploying={false}
            >
              <ContainerSection
                containers={formState.workloadFormData.containers || {}}
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
                singleContainerMode
                hideContainerFields
              />
            </WorkloadProvider>
          }
        />
      );
    }

    return null;
  };

  return (
    <>
      <DetailPageLayout
        title="Configure Overrides"
        subtitle={environment.name}
        onBack={onBack}
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
    </>
  );
};
