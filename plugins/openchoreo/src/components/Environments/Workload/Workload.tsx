import {
  Drawer,
  Button,
  Typography,
  Box,
  useTheme,
  IconButton,
  CircularProgress,
  Divider,
} from '@material-ui/core';
import { useEffect, useState } from 'react';
import { WorkloadEditor } from './WorkloadEditor';
import CloseIcon from '@material-ui/icons/Close';
import { ModelsWorkload, ModelsBuild } from '@openchoreo/backstage-plugin-api';
import { applyWorkload, fetchWorkloadInfo } from '../../../api/workloadInfo';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import { identityApiRef } from '@backstage/core-plugin-api';
import { Alert } from '@material-ui/lab';
import { WorkloadProvider } from './WorkloadContext';

export function Workload({
  onDeployed,
  isWorking,
  isOpen,
  onOpenChange,
}: {
  onDeployed: () => Promise<void>;
  isWorking: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const { entity } = useEntity();
  const theme = useTheme();
  const [workloadSpec, setWorkloadSpec] = useState<ModelsWorkload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);

  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        const response = await fetchWorkloadInfo(entity, discovery, identity);
        setWorkloadSpec(response);
      } catch (e) {
        setError('Failed to fetch workload info');
      }
      setIsLoading(false);
    };
    fetchWorkload();
    return () => {
      setIsLoading(true);
      setWorkloadSpec(null);
      setError(null);
    };
  }, [entity, discovery, identity]);

  useEffect(() => {
    const fetchBuilds = async () => {
      try {
        const componentName = entity.metadata.name;
        const projectName =
          entity.metadata.annotations?.['openchoreo.io/project'];
        const organizationName =
          entity.metadata.annotations?.['openchoreo.io/organization'];

        // Get authentication token
        const { token } = await identity.getCredentials();

        // Now fetch the builds
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
        // Handle error silently or set an error state if needed
        setBuilds([]);
      }
    };
    fetchBuilds();
  }, [entity.metadata.name, entity.metadata.annotations, identity, discovery]);

  const toggleDrawer = () => {
    onOpenChange(!isOpen);
  };

  const handleDeploy = async () => {
    if (!workloadSpec) {
      return;
    }
    setIsDeploying(true);
    try {
      await applyWorkload(entity, discovery, identity, workloadSpec);
      setTimeout(async () => {
        await onDeployed();
        onOpenChange(false);
      }, 3000);
    } catch (e) {
      setIsDeploying(false);
      throw new Error('Failed to deploy workload');
    }

  };

  const enableDeploy =
    (workloadSpec || builds.some(build => build.image)) && !isLoading;
  const hasBuilds = builds.length > 0 || workloadSpec;

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        flexDirection="column"
        gridGap={8}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          p={2}
        >
          {isLoading && !error && <CircularProgress />}
        </Box>
        {!enableDeploy && !isWorking && !isDeploying && (
          <Alert severity={!hasBuilds ? 'error' : 'warning'}>
            {!hasBuilds ? error : 'Build your application first.'}
      
          </Alert>
        )}
        <Button
          onClick={toggleDrawer}
          disabled={!enableDeploy || isDeploying || isLoading || isWorking}
          variant="contained"
          color="primary"
          size="small"
        >
          Configure & Deploy
        </Button>
      </Box>

      <Drawer open={isOpen} onClose={toggleDrawer} anchor="right">
        <Box
          minWidth={theme.spacing(80)}
          display="flex"
          flexDirection="column"
          height="100%"
          overflow="hidden"
        >
          <Box p={2} height="100%">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">
                Configure Workload
              </Typography>
              <IconButton onClick={toggleDrawer} color="default">
                <CloseIcon />
              </IconButton>
            </Box>
            <Divider />
            <Box flex={1} paddingBottom={2} overflow="auto" sx={{ height: 'calc(100% - 70px)' }}>
              <WorkloadProvider
                builds={builds}
                workloadSpec={workloadSpec}
                setWorkloadSpec={setWorkloadSpec}
                isDeploying={isDeploying || isLoading || isWorking}
              >
                <WorkloadEditor entity={entity} onDeploy={handleDeploy} />
              </WorkloadProvider>
            </Box>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
