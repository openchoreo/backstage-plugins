import { useEffect, useState } from 'react';
import { Box, Button, Tooltip } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import { Alert, Skeleton } from '@material-ui/lab';
import { stringifyEntityRef } from '@backstage/catalog-model';
import {
  ModelsBuild,
  openchoreoComponentDeployPermission,
} from '@openchoreo/backstage-plugin-common';
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
  const [error, setError] = useState<string | null>(null);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);

  // Check if user has permission to deploy
  const { allowed: canDeploy, loading: deployPermissionLoading } =
    usePermission({
      permission: openchoreoComponentDeployPermission,
      resourceRef: stringifyEntityRef(entity),
    });

  // Fetch workload info to check if it exists
  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        setIsLoading(true);
        await client.fetchWorkloadInfo(entity);
      } catch (e) {
        setError('Failed to fetch workload info');
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
        const organizationName =
          entity.metadata.annotations?.['openchoreo.io/organization'];

        const baseUrl = await discovery.getBaseUrl('openchoreo');

        if (projectName && organizationName && componentName) {
          const response = await fetchApi.fetch(
            `${baseUrl}/builds?componentName=${encodeURIComponent(
              componentName,
            )}&projectName=${encodeURIComponent(
              projectName,
            )}&organizationName=${encodeURIComponent(organizationName)}`,
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
  const enableDeploy = isFromSource
    ? builds.some(build => build.image) && !isLoading
    : !isLoading;

  const getAlertMessage = () => {
    if (isFromSource && !hasBuilds) {
      return 'Build your application first to generate a container image.';
    }
    return 'Configure your workload to enable deployment.';
  };

  if (isLoading && !error) {
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
      {!enableDeploy && (
        <Alert severity={isFromSource && !hasBuilds ? 'warning' : 'info'}>
          {getAlertMessage()}
        </Alert>
      )}
      <Tooltip
        title={
          !canDeploy && !deployPermissionLoading
            ? 'You do not have permission to deploy'
            : ''
        }
      >
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
