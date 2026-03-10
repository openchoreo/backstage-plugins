import {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import {
  useNavigate,
  useLocation,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import type { Navigator } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert, Skeleton } from '@material-ui/lab';
import { useEntity, catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  type ModelsWorkload,
  type WorkloadWithRaw,
  CHOREO_ANNOTATIONS,
} from '@openchoreo/backstage-plugin-common';
import {
  DetailPageLayout,
  UnsavedChangesDialog,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import type { ComponentTrait } from '../../../api/OpenChoreoClientApi';
import { WorkloadProvider } from './WorkloadContext';
import { WorkloadEditor } from './WorkloadEditor';
import { isFromSourceComponent } from '../../../utils/componentUtils';
import { useWorkloadChanges } from './hooks/useWorkloadChanges';
import { WorkloadSaveConfirmationDialog } from './WorkloadSaveConfirmationDialog';
import { usePendingChanges } from '../../Traits/hooks/usePendingChanges';
import { deepCompareObjects } from '@openchoreo/backstage-plugin-react';

/** Stable empty array to avoid unnecessary rerenders in WorkloadProvider */
const EMPTY_BUILDS: never[] = [];
const EMPTY_TRAITS: ComponentTrait[] = [];

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: '300px',
  },
  errorContainer: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.error.dark,
    marginBottom: theme.spacing(2),
  },
}));

interface WorkloadConfigPageProps {
  onBack: () => void;
  /** Called after workload is applied and release is created, navigates to overrides */
  onNext: (releaseName: string, targetEnvironment: string) => void;
  /** The lowest environment name (first in deployment pipeline) */
  lowestEnvironment: string;
  /** Initial tab to display (from URL) */
  initialTab?: string;
  /** Callback when tab changes (to update URL) */
  onTabChange?: (tab: string) => void;
}

export const WorkloadConfigPage = ({
  onBack,
  onNext,
  lowestEnvironment,
  initialTab,
  onTabChange,
}: WorkloadConfigPageProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);
  const { entity } = useEntity();

  // Workload state
  const [workloadSpec, setWorkloadSpec] = useState<ModelsWorkload | null>(null);
  const [initialWorkload, setInitialWorkload] = useState<ModelsWorkload | null>(
    null,
  );
  const [rawWorkload, setRawWorkload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewWorkload, setIsNewWorkload] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Component config state (traits + parameters)
  const [initialTraits, setInitialTraits] =
    useState<ComponentTrait[]>(EMPTY_TRAITS);
  const [hasParameters, setHasParameters] = useState(false);
  const [parametersSchema, setParametersSchema] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [componentParameters, setComponentParameters] = useState<
    Record<string, unknown>
  >({});
  const [initialParameters, setInitialParameters] = useState<
    Record<string, unknown>
  >({});
  const [allowedTraits, setAllowedTraits] = useState<Array<{
    kind?: string;
    name: string;
  }> | null>(null);
  const [traitsLoadError, setTraitsLoadError] = useState<string | null>(null);

  // Traits management via usePendingChanges
  const {
    traitsState,
    hasChanges: hasTraitChanges,
    addTrait,
    editTrait,
    deleteTrait,
    undoDelete,
    getTraitsForSave,
  } = usePendingChanges(initialTraits);

  // Parameter changes — exclude fields where the value matches the schema default
  // and the user never had a stored value (initialParameters doesn't have the key).
  const parameterChanges = useMemo(() => {
    const allChanges = deepCompareObjects(
      initialParameters,
      componentParameters,
    );
    if (!parametersSchema) return allChanges;
    const schemaProps = (parametersSchema as any)?.properties || {};
    return allChanges.filter(change => {
      const key = change.path.split('.')[0];
      // If the initial parameters already had this key, it's a real change
      if (key in initialParameters) return true;
      // Otherwise, check if the current value is just the schema default
      const schemaDef = schemaProps[key];
      if (schemaDef?.default !== undefined) {
        return (
          JSON.stringify(componentParameters[key]) !==
          JSON.stringify(schemaDef.default)
        );
      }
      return true;
    });
  }, [initialParameters, componentParameters, parametersSchema]);
  const hasParameterChanges = parameterChanges.length > 0;

  // Build the parameters payload for saving — only include keys that the user
  // has explicitly set or that already existed on the component CR.
  // Keys populated purely from schema defaults (with no stored value) are excluded.
  const getParametersForSave = useCallback((): Record<string, unknown> => {
    if (!parametersSchema) return componentParameters;
    const schemaProps = (parametersSchema as any)?.properties || {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(componentParameters)) {
      if (key in initialParameters) {
        // Key existed on the component — always include
        result[key] = value;
      } else {
        // Key only from schema defaults — include only if user changed it from default
        const schemaDef = schemaProps[key];
        if (
          schemaDef?.default === undefined ||
          JSON.stringify(value) !== JSON.stringify(schemaDef.default)
        ) {
          result[key] = value;
        }
      }
    }
    return result;
  }, [componentParameters, initialParameters, parametersSchema]);

  // Track if we should allow navigation (when user confirms discard)
  const allowNavigationRef = useRef(false);
  const pendingNavigationRef = useRef<{
    to: string;
    action: 'push' | 'replace';
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useContext(NavigationContext);

  // Calculate workload changes
  const workloadChanges = useWorkloadChanges(initialWorkload, workloadSpec);

  // Fetch workload and component config
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch workload and traits in parallel
        const [workloadResult, traitsResult] = await Promise.allSettled([
          client.fetchWorkloadInfo(entity),
          client.fetchComponentTraits(entity),
        ]);

        // Handle workload result
        if (workloadResult.status === 'fulfilled') {
          const response: WorkloadWithRaw = workloadResult.value;
          // Extract the full raw workload resource for YAML display
          const { _raw, ...spec } = response;
          if (_raw) {
            setRawWorkload(_raw as Record<string, unknown>);
          }
          setWorkloadSpec(spec as ModelsWorkload);
          setInitialWorkload(spec ? JSON.parse(JSON.stringify(spec)) : null);
          setIsNewWorkload(false);
        } else {
          if (isFromSourceComponent(entity)) {
            setError(
              'Workload configuration not found. The workload should have been created automatically after a successful build. Please re-run the build workflow.',
            );
          } else {
            setIsNewWorkload(true);
            const defaultWorkload = {
              name: entity.metadata.name,
              owner: {
                projectName:
                  entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ||
                  '',
                componentName: entity.metadata.name,
              },
              container: {
                image: '',
              },
              dependencies: { endpoints: [] },
              connections: [],
            };
            setWorkloadSpec(defaultWorkload);
            setInitialWorkload(JSON.parse(JSON.stringify(defaultWorkload)));
          }
        }

        // Handle traits result
        if (traitsResult.status === 'fulfilled') {
          setInitialTraits(traitsResult.value);
          setTraitsLoadError(null);
        } else {
          // Don't overwrite initialTraits with EMPTY_TRAITS — leave them unset
          // so the UI shows an error instead of silently treating all traits as absent
          setTraitsLoadError(
            'Failed to load traits. Trait editing is disabled until traits are loaded.',
          );
        }

        // Fetch the component type info: schema (for parameters) and allowedTraits.
        const componentTypeName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE];
        const componentTypeKind =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND];
        if (componentTypeName) {
          // Fetch CT schema from backend
          try {
            const schemaResult = await client.fetchComponentTypeSchema(entity);
            if (schemaResult.success && schemaResult.data) {
              const schema = schemaResult.data;
              const properties = (schema as any)?.properties;
              if (
                properties &&
                typeof properties === 'object' &&
                Object.keys(properties).length > 0
              ) {
                setHasParameters(true);
                setParametersSchema(schema);
              }
            }
          } catch {
            // Schema fetch failure is non-critical
          }

          // Fetch CT entity from catalog for allowedTraits
          try {
            const ctKind =
              componentTypeKind === 'ClusterComponentType'
                ? 'ClusterComponentType'
                : 'ComponentType';
            const ctFilter: Record<string, string> = { kind: ctKind };
            // Namespaced ComponentTypes live under the same namespace as the component
            if (ctKind === 'ComponentType') {
              const ns =
                entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
              if (ns) {
                ctFilter['metadata.namespace'] = ns;
              }
            }
            const ctEntities = await catalogApi.getEntities({
              filter: ctFilter,
            });
            const matchingCt = ctEntities.items.find(
              e =>
                `${e.spec?.workloadType}/${e.metadata.name}` ===
                componentTypeName,
            );
            const ctAllowedTraits = (matchingCt?.spec as any)?.allowedTraits as
              | Array<{ kind?: string; name: string }>
              | undefined;
            if (ctAllowedTraits && ctAllowedTraits.length > 0) {
              setAllowedTraits(ctAllowedTraits);
            }
          } catch {
            // CT entity fetch failure is non-critical
          }
        }

        try {
          const componentDetails = await client.getComponentDetails(entity);
          const params = componentDetails?.parameters;
          if (
            params &&
            typeof params === 'object' &&
            Object.keys(params).length > 0
          ) {
            setComponentParameters(params);
            setInitialParameters(JSON.parse(JSON.stringify(params)));
          }
        } catch {
          // Component details fetch failure is non-critical for parameters
        }
      } catch (e) {
        setError('Failed to load configuration');
      }
      setIsLoading(false);
    };
    fetchData();
    return () => {
      setWorkloadSpec(null);
      setInitialWorkload(null);
      setRawWorkload(null);
      setError(null);
      setIsNewWorkload(false);
      setInitialTraits(EMPTY_TRAITS);
      setHasParameters(false);
      setParametersSchema(null);
      setComponentParameters({});
      setInitialParameters({});
      setAllowedTraits(null);
      setTraitsLoadError(null);
    };
  }, [entity, client, catalogApi]);

  // Retry fetching traits when initial load failed
  const retryTraitsFetch = useCallback(async () => {
    try {
      setTraitsLoadError(null);
      const traits = await client.fetchComponentTraits(entity);
      setInitialTraits(traits);
    } catch {
      setTraitsLoadError(
        'Failed to load traits. Trait editing is disabled until traits are loaded.',
      );
    }
  }, [client, entity]);

  // Combined unsaved state
  const hasUnsavedWork =
    workloadChanges.hasChanges ||
    hasTraitChanges ||
    hasParameterChanges ||
    isEditing;

  // Warn user before leaving page with unsaved changes (browser navigation/tab close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork && !allowNavigationRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedWork]);

  // Block in-app navigation when there are unsaved changes (menu clicks, etc.)
  useEffect(() => {
    if (!hasUnsavedWork || !navigation) {
      return undefined;
    }

    const navigator = navigation.navigator as Navigator;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const currentPathname = location.pathname;

    const isSamePageNavigation = (to: any): boolean => {
      const targetPathname =
        typeof to === 'string' ? to.split('?')[0] : to.pathname;
      return targetPathname === currentPathname;
    };

    navigator.push = (to: any, state?: any) => {
      if (allowNavigationRef.current || isSamePageNavigation(to)) {
        originalPush.call(navigator, to, state);
        return;
      }
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'push',
      };
      setShowUnsavedChangesDialog(true);
    };

    navigator.replace = (to: any, state?: any) => {
      if (allowNavigationRef.current || isSamePageNavigation(to)) {
        originalReplace.call(navigator, to, state);
        return;
      }
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'replace',
      };
      setShowUnsavedChangesDialog(true);
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [hasUnsavedWork, navigation, location.pathname]);

  const isFromSource = isFromSourceComponent(entity);
  const hasImage = !!workloadSpec?.container?.image?.trim();

  const hasAnyChanges =
    workloadChanges.hasChanges || hasTraitChanges || hasParameterChanges;

  const handleNext = async () => {
    if (!workloadSpec) {
      return;
    }
    if (!isFromSource && !workloadSpec.container?.image?.trim()) {
      setError('A container image is required before proceeding.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      // Step 1: Apply workload (if changed)
      if (workloadChanges.hasChanges) {
        await client.applyWorkload(entity, workloadSpec);
      }

      // Step 2: Update component config (traits/parameters) if changed
      if (hasTraitChanges || hasParameterChanges) {
        await client.updateComponentConfig(
          entity,
          hasTraitChanges ? getTraitsForSave() : undefined,
          hasParameterChanges ? getParametersForSave() : undefined,
        );
      }

      // Step 3: Create ComponentRelease
      const releaseResponse = await client.createComponentRelease(entity);

      if (!releaseResponse.data?.name) {
        throw new Error('Failed to create release: no release name returned');
      }

      const releaseName = releaseResponse.data.name;

      // Step 4: Navigate to overrides page
      setIsProcessing(false);
      allowNavigationRef.current = true;
      onNext(releaseName, lowestEnvironment);
    } catch (e: any) {
      setIsProcessing(false);
      setError(e.message || 'Failed to create release');
    }
  };

  const enableNext = isFromSource
    ? hasImage && !isLoading
    : !isLoading && !!workloadSpec?.container?.image?.trim();

  const getAlertMessage = () => {
    if (isFromSource && !hasImage) {
      return 'Build your application first to generate a container image.';
    }
    return 'Configure your workload to enable deployment.';
  };

  const handleButtonClick = () => {
    if (hasAnyChanges) {
      setShowConfirmDialog(true);
    } else {
      handleNext();
    }
  };

  const handleConfirmSave = () => {
    setShowConfirmDialog(false);
    handleNext();
  };

  const handleBackClick = () => {
    if (hasUnsavedWork) {
      setShowUnsavedChangesDialog(true);
    } else {
      onBack();
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (hasAnyChanges) return 'Save & Next';
    return 'Next';
  };

  const totalChanges =
    workloadChanges.total +
    (hasTraitChanges
      ? traitsState.filter(t => t.state !== 'original').length
      : 0) +
    parameterChanges.length;

  // Header actions - Next/Save & Next button
  const headerActions = !isLoading ? (
    <Button
      variant="contained"
      color="primary"
      onClick={handleButtonClick}
      disabled={isProcessing || isLoading || !enableNext || isEditing}
      startIcon={
        isProcessing ? (
          <CircularProgress size={20} color="inherit" />
        ) : undefined
      }
    >
      {getButtonText()}
    </Button>
  ) : null;

  // Callbacks for traits (stable references)
  const handleAddTrait = useCallback(
    (trait: ComponentTrait) => addTrait(trait),
    [addTrait],
  );
  const handleEditTrait = useCallback(
    (instanceName: string, updated: ComponentTrait) =>
      editTrait(instanceName, updated),
    [editTrait],
  );
  const handleDeleteTrait = useCallback(
    (instanceName: string) => deleteTrait(instanceName),
    [deleteTrait],
  );
  const handleUndoDeleteTrait = useCallback(
    (instanceName: string) => undoDelete(instanceName),
    [undoDelete],
  );

  return (
    <DetailPageLayout
      title="Configure Component"
      subtitle="Review and update your component's runtime configuration"
      onBack={handleBackClick}
      actions={headerActions}
    >
      {isLoading && (
        <Box className={classes.loadingContainer}>
          <Skeleton variant="rect" width="100%" height={200} />
          <Skeleton variant="rect" width="100%" height={100} />
          <Skeleton variant="rect" width="100%" height={100} />
        </Box>
      )}

      {error && !isLoading && (
        <Box className={classes.errorContainer}>
          <Typography variant="body1">{error}</Typography>
        </Box>
      )}

      {!isLoading && !error && isNewWorkload && (
        <Box mb={2}>
          <Alert severity="info">
            Configure your workload below to enable deployment.
          </Alert>
        </Box>
      )}

      {!isLoading && !error && !isNewWorkload && !enableNext && (
        <Box mb={2}>
          <Alert severity={isFromSource && !hasImage ? 'warning' : 'info'}>
            {getAlertMessage()}
          </Alert>
        </Box>
      )}

      {!isLoading && !error && (
        <WorkloadProvider
          builds={EMPTY_BUILDS}
          workloadSpec={workloadSpec}
          setWorkloadSpec={setWorkloadSpec}
          isDeploying={isProcessing || isLoading}
          initialWorkload={initialWorkload}
          onEditingChange={setIsEditing}
        >
          <WorkloadEditor
            entity={entity}
            rawWorkload={rawWorkload}
            initialTab={initialTab}
            onTabChange={onTabChange}
            traitsState={traitsState}
            allowedTraits={allowedTraits}
            onAddTrait={handleAddTrait}
            onEditTrait={handleEditTrait}
            onDeleteTrait={handleDeleteTrait}
            onUndoDeleteTrait={handleUndoDeleteTrait}
            hasTraitChanges={hasTraitChanges}
            traitsLoadError={traitsLoadError}
            onRetryTraits={retryTraitsFetch}
            hasParameters={hasParameters}
            parametersSchema={parametersSchema}
            parameters={componentParameters}
            onParametersChange={setComponentParameters}
            hasParameterChanges={hasParameterChanges}
            workloadChanges={workloadChanges}
            parameterChangesCount={parameterChanges.length}
          />
        </WorkloadProvider>
      )}

      <WorkloadSaveConfirmationDialog
        open={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSave}
        changes={workloadChanges}
        saving={isProcessing}
        traitsState={hasTraitChanges ? traitsState : undefined}
        parameterChanges={parameterChanges}
      />

      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        onDiscard={() => {
          allowNavigationRef.current = true;
          setShowUnsavedChangesDialog(false);

          if (pendingNavigationRef.current) {
            const { to, action } = pendingNavigationRef.current;
            if (action === 'push') {
              navigate(to);
            } else {
              navigate(to, { replace: true });
            }
            pendingNavigationRef.current = null;
          } else {
            onBack();
          }

          setTimeout(() => {
            allowNavigationRef.current = false;
          }, 100);
        }}
        onStay={() => {
          setShowUnsavedChangesDialog(false);
          pendingNavigationRef.current = null;
        }}
        changeCount={totalChanges}
      />
    </DetailPageLayout>
  );
};
