import { useEffect, useState, useRef, useContext, useCallback } from 'react';
import {
  useNavigate,
  useLocation,
  UNSAFE_NavigationContext as NavigationContext,
} from 'react-router-dom';
import type { Navigator } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert, Skeleton } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  ModelsWorkload,
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
import {
  deepCompareObjects,
} from '@openchoreo/backstage-plugin-react';

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
  const { entity } = useEntity();

  // Workload state
  const [workloadSpec, setWorkloadSpec] = useState<ModelsWorkload | null>(null);
  const [initialWorkload, setInitialWorkload] = useState<ModelsWorkload | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewWorkload, setIsNewWorkload] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Component config state (traits + parameters)
  const [initialTraits, setInitialTraits] = useState<ComponentTrait[]>(EMPTY_TRAITS);
  const [hasParameters, setHasParameters] = useState(false);
  const [componentParameters, setComponentParameters] = useState<Record<string, unknown>>({});
  const [initialParameters, setInitialParameters] = useState<Record<string, unknown>>({});

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

  // Parameter changes
  const parameterChanges = deepCompareObjects(initialParameters, componentParameters);
  const hasParameterChanges = parameterChanges.length > 0;

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
          const response = workloadResult.value;
          setWorkloadSpec(response);
          setInitialWorkload(
            response ? JSON.parse(JSON.stringify(response)) : null,
          );
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
                  entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] || '',
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
        }

        // Note: Parameters are fetched from component details.
        // For now, we check if the component has parameters by looking at
        // the component spec. We don't show the Parameters tab if the
        // component response doesn't have spec.parameters.
        try {
          const componentDetails = await client.getComponentDetails(entity);
          const params = (componentDetails as any)?.parameters;
          if (params && typeof params === 'object' && Object.keys(params).length > 0) {
            setHasParameters(true);
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
      setError(null);
      setIsNewWorkload(false);
      setInitialTraits(EMPTY_TRAITS);
      setHasParameters(false);
      setComponentParameters({});
      setInitialParameters({});
    };
  }, [entity, client]);

  // Combined unsaved state
  const hasUnsavedWork =
    workloadChanges.hasChanges || hasTraitChanges || hasParameterChanges || isEditing;

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

  const hasAnyChanges = workloadChanges.hasChanges || hasTraitChanges || hasParameterChanges;

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
          hasParameterChanges ? componentParameters : undefined,
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
      subtitle="Configure workload, parameters, and traits for deployment"
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
            initialTab={initialTab}
            onTabChange={onTabChange}
            traitsState={traitsState}
            onAddTrait={handleAddTrait}
            onEditTrait={handleEditTrait}
            onDeleteTrait={handleDeleteTrait}
            onUndoDeleteTrait={handleUndoDeleteTrait}
            hasTraitChanges={hasTraitChanges}
            hasParameters={hasParameters}
            parameters={componentParameters}
            onParametersChange={setComponentParameters}
            hasParameterChanges={hasParameterChanges}
          />
        </WorkloadProvider>
      )}

      <WorkloadSaveConfirmationDialog
        open={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSave}
        changes={workloadChanges}
        saving={isProcessing}
        traitChangesCount={
          hasTraitChanges
            ? traitsState.filter(t => t.state !== 'original').length
            : 0
        }
        parameterChangesCount={parameterChanges.length}
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
