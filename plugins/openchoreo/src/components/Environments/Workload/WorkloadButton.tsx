import { useEffect, useState } from 'react';
import { Box, Button, Tooltip } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { Alert, Skeleton } from '@material-ui/lab';
import { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { useDeployPermission } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isFromSourceComponent } from '../../../utils/componentUtils';

interface WorkloadButtonProps {
  onConfigureWorkload: () => void;
  isWorking?: boolean;
}

/**
 * Button component for triggering workload configuration
 * Displays in the SetupCard and handles loading/validation states
 */
export const WorkloadButton = ({
  onConfigureWorkload,
  isWorking = false,
}: WorkloadButtonProps) => {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();

  const [isLoading, setIsLoading] = useState(true);
  const [hasWorkload, setHasWorkload] = useState(false);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);

  // Check if user has permission to deploy
  const {
    canDeploy,
    loading: deployPermissionLoading,
    deniedTooltip,
  } = useDeployPermission();

  // Fetch workload info to check if it exists
  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        setIsLoading(true);
        await client.fetchWorkloadInfo(entity);
        setHasWorkload(true);
      } catch (e) {
        setHasWorkload(false);
      }
      setIsLoading(false);
    };
    fetchWorkload();
  }, [entity, client]);

  // Fetch builds to check if deployment is possible
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

  const isFromSource = isFromSourceComponent(entity);
  const hasBuilds = builds.length > 0;
  const hasSuccessfulBuild = builds.some(build => build.image);

  // Determine if Configure & Deploy should be enabled
  const enableDeploy = (() => {
    if (isLoading) return false;

    if (isFromSource) {
      // From-source: need successful build AND workload
      if (!hasBuilds) return false;
      if (!hasSuccessfulBuild) return false;
      if (!hasWorkload) return false; // Has builds but no workload - bug state
      return true;
    }
    // Pre-built image: always allow (user configures workload manually)
    return true;
  })();

  const getAlertMessage = (): string | null => {
    if (isFromSource) {
      if (!hasBuilds) {
        return 'Build your application first to generate a container image.';
      }
      if (hasSuccessfulBuild && !hasWorkload) {
        return 'Workload configuration was not created automatically. Please re-run the build workflow or contact support.';
      }
    }
    if (!hasWorkload) {
      return 'Configure your workload to enable deployment.';
    }
    return null;
  };

  const alertMessage = getAlertMessage();
  const getAlertSeverity = (): 'error' | 'warning' | 'info' => {
    if (isFromSource && hasSuccessfulBuild && !hasWorkload) {
      return 'error';
    }
    if (isFromSource && !hasBuilds) {
      return 'warning';
    }
    return 'info';
  };
  const alertSeverity = getAlertSeverity();

  if (isLoading) {
    return (
      <Box p={2}>
        <Skeleton variant="rect" width="100%" height={40} />
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      flexDirection="column"
      gridGap={16}
      mt="auto"
    >
      {alertMessage && <Alert severity={alertSeverity}>{alertMessage}</Alert>}
      <Tooltip title={deniedTooltip}>
        <span style={{ alignSelf: 'flex-end' }}>
          <Button
            onClick={onConfigureWorkload}
            disabled={
              !enableDeploy ||
              isLoading ||
              isWorking ||
              deployPermissionLoading ||
              !canDeploy
            }
            variant="contained"
            color="primary"
            size="small"
          >
            Configure & Deploy
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
};
