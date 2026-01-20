import { useEffect, useState, useRef, useContext } from 'react';
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
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  ModelsWorkload,
  ModelsBuild,
} from '@openchoreo/backstage-plugin-common';
import {
  DetailPageLayout,
  UnsavedChangesDialog,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { WorkloadProvider } from './WorkloadContext';
import { WorkloadEditor } from './WorkloadEditor';
import { isFromSourceComponent } from '../../../utils/componentUtils';
import { useWorkloadChanges } from './hooks/useWorkloadChanges';
import { WorkloadSaveConfirmationDialog } from './WorkloadSaveConfirmationDialog';

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
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();

  const [workloadSpec, setWorkloadSpec] = useState<ModelsWorkload | null>(null);
  const [initialWorkload, setInitialWorkload] = useState<ModelsWorkload | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  // Track if any row is being edited in child components
  const [isEditing, setIsEditing] = useState(false);

  // Track if we should allow navigation (when user confirms discard)
  const allowNavigationRef = useRef(false);
  const pendingNavigationRef = useRef<{
    to: string;
    action: 'push' | 'replace';
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useContext(NavigationContext);

  // Calculate changes between initial and current workload
  const changes = useWorkloadChanges(initialWorkload, workloadSpec);

  // Fetch workload info
  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        setIsLoading(true);
        const response = await client.fetchWorkloadInfo(entity);
        setWorkloadSpec(response);
        // Store a deep copy as initial state for change comparison
        setInitialWorkload(
          response ? JSON.parse(JSON.stringify(response)) : null,
        );
      } catch (e) {
        setError('Failed to fetch workload info');
      }
      setIsLoading(false);
    };
    fetchWorkload();
    return () => {
      setWorkloadSpec(null);
      setInitialWorkload(null);
      setError(null);
    };
  }, [entity, client]);

  // Fetch builds
  useEffect(() => {
    const fetchBuilds = async () => {
      try {
        const componentName = entity.metadata.name;
        const projectName =
          entity.metadata.annotations?.['openchoreo.io/project'];
        const namespaceName =
          entity.metadata.annotations?.['openchoreo.io/namespace'];

        const baseUrl = await discovery.getBaseUrl('openchoreo');

        if (projectName && namespaceName && componentName) {
          const response = await fetchApi.fetch(
            `${baseUrl}/builds?componentName=${encodeURIComponent(
              componentName,
            )}&projectName=${encodeURIComponent(
              projectName,
            )}&namespaceName=${encodeURIComponent(namespaceName)}`,
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const buildsData = await response.json();
          setBuilds(buildsData);
        }
      } catch (err) {
        setBuilds([]);
      }
    };
    fetchBuilds();
  }, [entity.metadata.name, entity.metadata.annotations, fetchApi, discovery]);

  // Combined unsaved state: either applied changes or in-progress edits
  const hasUnsavedWork = changes.hasChanges || isEditing;

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

    // Check if navigation is within the same page (e.g., tab switching)
    const isSamePageNavigation = (to: any): boolean => {
      const targetPathname =
        typeof to === 'string' ? to.split('?')[0] : to.pathname;
      return targetPathname === currentPathname;
    };

    // Override push method
    navigator.push = (to: any, state?: any) => {
      // Allow navigation if explicitly allowed or if it's within the same page
      if (allowNavigationRef.current || isSamePageNavigation(to)) {
        originalPush.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'push',
      };

      // Show confirmation dialog
      setShowUnsavedChangesDialog(true);
    };

    // Override replace method
    navigator.replace = (to: any, state?: any) => {
      // Allow navigation if explicitly allowed or if it's within the same page
      if (allowNavigationRef.current || isSamePageNavigation(to)) {
        originalReplace.call(navigator, to, state);
        return;
      }

      // Store pending navigation
      pendingNavigationRef.current = {
        to: typeof to === 'string' ? to : to.pathname,
        action: 'replace',
      };

      // Show confirmation dialog
      setShowUnsavedChangesDialog(true);
    };

    // Cleanup - restore original methods
    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [hasUnsavedWork, navigation, location.pathname]);

  const handleNext = async () => {
    if (!workloadSpec) {
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      // Step 1: Apply workload
      await client.applyWorkload(entity, workloadSpec);

      // Step 2: Create ComponentRelease (auto-generated name)
      const releaseResponse = await client.createComponentRelease(entity);

      if (!releaseResponse.data?.name) {
        throw new Error('Failed to create release: no release name returned');
      }

      const releaseName = releaseResponse.data.name;

      // Step 3: Navigate to overrides page
      setIsProcessing(false);
      allowNavigationRef.current = true;
      onNext(releaseName, lowestEnvironment);
    } catch (e: any) {
      setIsProcessing(false);
      setError(e.message || 'Failed to create release');
    }
  };

  const isFromSource = isFromSourceComponent(entity);
  const hasBuilds = builds.length > 0;
  const enableNext = isFromSource
    ? builds.some(build => build.image) && !isLoading
    : !isLoading;

  const getAlertMessage = () => {
    if (isFromSource && !hasBuilds) {
      return 'Build your application first to generate a container image.';
    }
    return 'Configure your workload to enable deployment.';
  };

  // Handle button click - show confirmation dialog if there are changes
  const handleButtonClick = () => {
    if (changes.hasChanges) {
      setShowConfirmDialog(true);
    } else {
      handleNext();
    }
  };

  // Handle confirmation dialog confirm
  const handleConfirmSave = () => {
    setShowConfirmDialog(false);
    handleNext();
  };

  // Handle back button click - show warning if there are unsaved changes
  const handleBackClick = () => {
    if (hasUnsavedWork) {
      setShowUnsavedChangesDialog(true);
    } else {
      onBack();
    }
  };

  // Determine button text based on changes
  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (changes.hasChanges) return 'Save & Next';
    return 'Next';
  };

  // Header actions - Next/Save & Next button
  const headerActions = !isLoading ? (
    <Button
      variant="contained"
      color="primary"
      onClick={handleButtonClick}
      disabled={isProcessing || isLoading || !enableNext}
      startIcon={
        isProcessing ? (
          <CircularProgress size={20} color="inherit" />
        ) : undefined
      }
    >
      {getButtonText()}
    </Button>
  ) : null;

  return (
    <DetailPageLayout
      title="Configure Workload"
      subtitle="Configure containers, endpoints, and connections for deployment"
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

      {!isLoading && !error && !enableNext && (
        <Box mb={2}>
          <Alert severity={isFromSource && !hasBuilds ? 'warning' : 'info'}>
            {getAlertMessage()}
          </Alert>
        </Box>
      )}

      {!isLoading && (
        <WorkloadProvider
          builds={builds}
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
          />
        </WorkloadProvider>
      )}

      <WorkloadSaveConfirmationDialog
        open={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSave}
        changes={changes}
        saving={isProcessing}
      />

      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        onDiscard={() => {
          // Allow navigation to proceed
          allowNavigationRef.current = true;
          setShowUnsavedChangesDialog(false);

          // Proceed with the pending navigation if any
          if (pendingNavigationRef.current) {
            const { to, action } = pendingNavigationRef.current;
            if (action === 'push') {
              navigate(to);
            } else {
              navigate(to, { replace: true });
            }
            pendingNavigationRef.current = null;
          } else {
            // No pending navigation, use the back button handler
            onBack();
          }

          // Reset the flag after navigation
          setTimeout(() => {
            allowNavigationRef.current = false;
          }, 100);
        }}
        onStay={() => {
          setShowUnsavedChangesDialog(false);
          // Clear pending navigation
          pendingNavigationRef.current = null;
        }}
        changeCount={changes.total}
      />
    </DetailPageLayout>
  );
};
