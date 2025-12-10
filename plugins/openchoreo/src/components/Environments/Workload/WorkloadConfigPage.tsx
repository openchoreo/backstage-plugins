import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert, Skeleton } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  ModelsWorkload,
  ModelsBuild,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { WorkloadProvider } from './WorkloadContext';
import { WorkloadEditor } from './WorkloadEditor';
import { DetailPageLayout } from '../components/DetailPageLayout';
import { isFromSourceComponent } from '../../../utils/componentUtils';
import { useWorkloadChanges } from './hooks/useWorkloadChanges';
import { WorkloadSaveConfirmationDialog } from './WorkloadSaveConfirmationDialog';
import { UnsavedChangesDialog } from '@openchoreo/backstage-plugin-react';

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
  const identity = useApi(identityApiRef);
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
        const organizationName =
          entity.metadata.annotations?.['openchoreo.io/organization'];

        const { token } = await identity.getCredentials();
        const baseUrl = await discovery.getBaseUrl('openchoreo');

        if (projectName && organizationName && componentName) {
          const response = await fetch(
            `${baseUrl}/builds?componentName=${encodeURIComponent(
              componentName,
            )}&projectName=${encodeURIComponent(
              projectName,
            )}&organizationName=${encodeURIComponent(organizationName)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
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
  }, [entity.metadata.name, entity.metadata.annotations, identity, discovery]);

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
    if (changes.hasChanges) {
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
          setShowUnsavedChangesDialog(false);
          onBack();
        }}
        onStay={() => setShowUnsavedChangesDialog(false)}
        changeCount={changes.total}
      />
    </DetailPageLayout>
  );
};
