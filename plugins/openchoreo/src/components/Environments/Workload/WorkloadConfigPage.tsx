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
import { JSONSchema7 } from 'json-schema';
import { applyWorkload, fetchWorkloadInfo } from '../../../api/workloadInfo';
import {
  createComponentRelease,
  deployRelease,
  fetchComponentReleaseSchema,
  fetchReleaseBindings,
  ReleaseBinding,
} from '../../../api/environments';
import { WorkloadProvider } from './WorkloadContext';
import { WorkloadEditor } from './WorkloadEditor';
import { DetailPageLayout } from '../components/DetailPageLayout';
import { isFromSourceComponent } from '../../../utils/componentUtils';
import { getMissingRequiredFields } from '../overridesUtils';

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
  onDeployed: () => Promise<void>;
  /** Called when required overrides are missing and user needs to configure them */
  onRequiredOverridesMissing?: (
    releaseName: string,
    environmentName: string,
  ) => void;
  /** The lowest environment name (first in deployment pipeline) */
  lowestEnvironment: string;
}

export const WorkloadConfigPage = ({
  onBack,
  onDeployed,
  onRequiredOverridesMissing,
  lowestEnvironment,
}: WorkloadConfigPageProps) => {
  const classes = useStyles();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const { entity } = useEntity();

  const [workloadSpec, setWorkloadSpec] = useState<ModelsWorkload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);

  // Fetch workload info
  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        setIsLoading(true);
        const response = await fetchWorkloadInfo(entity, discovery, identity);
        setWorkloadSpec(response);
      } catch (e) {
        setError('Failed to fetch workload info');
      }
      setIsLoading(false);
    };
    fetchWorkload();
    return () => {
      setWorkloadSpec(null);
      setError(null);
    };
  }, [entity, discovery, identity]);

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

  /**
   * Check if required overrides are missing for a release
   */
  const checkRequiredOverrides = async (
    releaseName: string,
    environmentName: string,
  ): Promise<string[]> => {
    try {
      // Fetch schema for the release
      const schemaResponse = await fetchComponentReleaseSchema(
        entity,
        discovery,
        identity,
        releaseName,
      );

      if (!schemaResponse.success || !schemaResponse.data) {
        return []; // No schema = no required fields
      }

      // Extract componentTypeEnvOverrides schema
      // The schema response can have different structures depending on the backend
      const schemaData = schemaResponse.data as Record<string, unknown>;

      // Try direct access first (componentTypeEnvOverrides at root)
      let componentTypeSchema = schemaData.componentTypeEnvOverrides as
        | JSONSchema7
        | undefined;

      // If not found, try nested under properties (for wrapped schema)
      if (!componentTypeSchema && schemaData.properties) {
        const propsData = schemaData.properties as Record<string, unknown>;
        componentTypeSchema = propsData.componentTypeEnvOverrides as
          | JSONSchema7
          | undefined;
      }

      // Check if there are actually required fields
      if (
        !componentTypeSchema?.required ||
        !Array.isArray(componentTypeSchema.required) ||
        componentTypeSchema.required.length === 0
      ) {
        return []; // No required fields
      }

      // Fetch existing bindings to check current values
      const bindingsResponse = await fetchReleaseBindings(
        entity,
        discovery,
        identity,
      );

      let currentOverrides: Record<string, unknown> = {};
      if (bindingsResponse.success && bindingsResponse.data?.items) {
        const bindings = bindingsResponse.data.items as ReleaseBinding[];
        const binding = bindings.find(
          b => b.environment.toLowerCase() === environmentName.toLowerCase(),
        );
        if (binding?.componentTypeEnvOverrides) {
          currentOverrides = binding.componentTypeEnvOverrides as Record<
            string,
            unknown
          >;
        }
      }

      return getMissingRequiredFields(componentTypeSchema, currentOverrides);
    } catch {
      // On error, don't block - allow deployment to proceed
      return [];
    }
  };

  const handleDeploy = async () => {
    if (!workloadSpec) {
      return;
    }
    setIsDeploying(true);
    setError(null);
    try {
      // Step 1: Apply workload
      await applyWorkload(entity, discovery, identity, workloadSpec);

      // Step 2: Create ComponentRelease (auto-generated name)
      const releaseResponse = await createComponentRelease(
        entity,
        discovery,
        identity,
      );

      if (!releaseResponse.data?.name) {
        throw new Error('Failed to create release: no release name returned');
      }

      const releaseName = releaseResponse.data.name;
      const targetEnvironment = lowestEnvironment;

      // Step 3: Check for required overrides
      const missingFields = await checkRequiredOverrides(
        releaseName,
        targetEnvironment,
      );

      if (missingFields.length > 0 && onRequiredOverridesMissing) {
        // Required overrides are missing - redirect to configure overrides
        setIsDeploying(false);
        onRequiredOverridesMissing(releaseName, targetEnvironment);
        return;
      }

      // Step 4: Deploy release to lowest environment
      await deployRelease(entity, discovery, identity, releaseName);

      // Step 5: Navigate back and refresh
      setIsDeploying(false);
      await onDeployed();
      onBack();
    } catch (e: any) {
      setIsDeploying(false);
      setError(e.message || 'Failed to deploy workload');
    }
  };

  const isFromSource = isFromSourceComponent(entity);
  const hasBuilds = builds.length > 0;
  const enableDeploy = isFromSource
    ? builds.some(build => build.image) && !isLoading
    : !isLoading;

  const getAlertMessage = () => {
    if (isFromSource && !hasBuilds) {
      return 'Build your application first to generate a container image.';
    }
    return 'Configure your workload to enable deployment.';
  };

  // Header actions - deploy button moved from WorkloadEditor
  const headerActions = !isLoading ? (
    <Button
      variant="contained"
      color="primary"
      onClick={handleDeploy}
      disabled={isDeploying || isLoading || !enableDeploy}
      startIcon={
        isDeploying ? <CircularProgress size={20} color="inherit" /> : undefined
      }
    >
      {isDeploying ? 'Deploying...' : 'Submit & Deploy'}
    </Button>
  ) : null;

  return (
    <DetailPageLayout
      title="Configure Workload"
      subtitle="Configure containers, endpoints, and connections for deployment"
      onBack={onBack}
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

      {!isLoading && !error && !enableDeploy && (
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
          isDeploying={isDeploying || isLoading}
        >
          <WorkloadEditor entity={entity} />
        </WorkloadProvider>
      )}
    </DetailPageLayout>
  );
};
