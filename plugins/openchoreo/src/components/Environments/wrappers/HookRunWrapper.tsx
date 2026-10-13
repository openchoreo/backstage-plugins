import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Typography, Button } from '@material-ui/core';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { HookRunPage } from '../HookRunPage';

/**
 * Wrapper for HookRunPage that resolves the environment and hook binding from
 * the URL (/hook/:envName/:phase/:hookName).
 */
export const HookRunWrapper = () => {
  const { envName, phase, hookName } = useParams<{
    envName: string;
    phase: string;
    hookName: string;
  }>();
  const { entity } = useEntity();
  const { displayEnvironments, hooksByEnvironment, refetch, loading } =
    useEnvironmentsContext();
  const { navigateToList } = useEnvironmentRouting();

  const environment = useMemo(() => {
    if (!envName) return undefined;
    const decoded = decodeURIComponent(envName).toLowerCase();
    return displayEnvironments.find(e => e.name.toLowerCase() === decoded);
  }, [envName, displayEnvironments]);

  const hook = useMemo(() => {
    if (!environment || !hookName) return undefined;
    const hooks = hooksByEnvironment.get(environment.name);
    const rows = phase === 'postDeploy' ? hooks?.post : hooks?.pre;
    return rows?.find(r => r.name === decodeURIComponent(hookName));
  }, [environment, hooksByEnvironment, phase, hookName]);

  if (!environment || !hook) {
    if (loading) return null;
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={300}
        p={4}
      >
        <Typography variant="h6" gutterBottom>
          Hook Not Found
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          No hook "{hookName}" is bound on "{envName}".
        </Typography>
        <Button variant="outlined" onClick={navigateToList}>
          Back to Environments
        </Button>
      </Box>
    );
  }

  return (
    <HookRunPage
      environment={environment}
      hook={hook}
      namespaceName={
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? ''
      }
      catalogNamespace={entity.metadata.namespace || 'default'}
      onBack={navigateToList}
      onRetried={refetch}
    />
  );
};
