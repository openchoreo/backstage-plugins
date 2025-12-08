import { useCallback, useState, useEffect, useMemo } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Progress } from '@backstage/core-components';
import { Box } from '@material-ui/core';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';

import { useNotification } from '../../hooks';
import {
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentRouting,
} from './hooks';
import { useAutoDeployUpdate } from './hooks/useAutoDeployUpdate';
import type { PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { EnvironmentsRouter } from './EnvironmentsRouter';
import { EnvironmentsProvider } from './EnvironmentsContext';
import { NotificationBanner } from './components';
import { deployRelease, promoteToEnvironment } from '../../api/environments';
import { getComponentDetails } from '../../api/runtimeLogs';

export const Environments = () => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Routing
  const { navigateToList } = useEnvironmentRouting();

  // Data fetching
  const { environments, loading, refetch } = useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Auto deploy state
  const [autoDeploy, setAutoDeploy] = useState<boolean | undefined>(undefined);
  const { updateAutoDeploy, isUpdating: autoDeployUpdating } =
    useAutoDeployUpdate(entity, discovery, identityApi);

  // Notifications
  const notification = useNotification();

  // Fetch component details to get autoDeploy value
  useEffect(() => {
    const fetchComponentData = async () => {
      try {
        const componentData = await getComponentDetails(
          entity,
          discovery,
          identityApi,
        );
        if (componentData && 'autoDeploy' in componentData) {
          setAutoDeploy((componentData as any).autoDeploy);
        }
      } catch (err) {
        // Silently fail - autoDeploy will remain undefined
      }
    };

    fetchComponentData();
  }, [entity, discovery, identityApi]);

  // Polling for pending deployments
  useEnvironmentPolling(isPending, refetch);

  // Check if workload editor is supported
  const isWorkloadEditorSupported = useMemo(
    () =>
      !!(
        entity.metadata.tags?.find(
          tag => tag === 'webapplication' || tag === 'service',
        ) ||
        entity.metadata.annotations?.['openchoreo.io/component'] !== undefined
      ),
    [entity],
  );

  // Handler for auto deploy toggle change
  const handleAutoDeployChange = useCallback(
    async (newAutoDeploy: boolean) => {
      const success = await updateAutoDeploy(newAutoDeploy);
      if (success) {
        setAutoDeploy(newAutoDeploy);
        notification.showSuccess(
          `Auto deploy ${newAutoDeploy ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, notification],
  );

  // Handler for when overrides are saved with a pending action
  const handlePendingActionComplete = useCallback(
    async (pendingAction: PendingAction) => {
      try {
        if (pendingAction.type === 'deploy') {
          // Complete the deploy after overrides are saved
          await deployRelease(
            entity,
            discovery,
            identityApi,
            pendingAction.releaseName,
          );
          notification.showSuccess(
            `Successfully deployed to ${pendingAction.targetEnvironment}`,
          );
        } else if (pendingAction.type === 'promote') {
          // Complete the promote after overrides are saved
          await promoteToEnvironment(
            entity,
            discovery,
            identityApi,
            pendingAction.sourceEnvironment.toLowerCase(),
            pendingAction.targetEnvironment.toLowerCase(),
          );
          notification.showSuccess(
            `Successfully promoted to ${pendingAction.targetEnvironment}`,
          );
        }
        refetch();
        navigateToList();
      } catch (err: any) {
        notification.showError(
          err.message || `Failed to complete ${pendingAction.type}`,
        );
        navigateToList();
      }
    },
    [entity, discovery, identityApi, notification, refetch, navigateToList],
  );

  // Context value
  const contextValue = useMemo(
    () => ({
      environments,
      displayEnvironments,
      loading,
      refetch,
      lowestEnvironment: environments[0]?.name?.toLowerCase() || 'development',
      isWorkloadEditorSupported,
      autoDeploy,
      autoDeployUpdating,
      onAutoDeployChange: handleAutoDeployChange,
      onPendingActionComplete: handlePendingActionComplete,
    }),
    [
      environments,
      displayEnvironments,
      loading,
      refetch,
      isWorkloadEditorSupported,
      autoDeploy,
      autoDeployUpdating,
      handleAutoDeployChange,
      handlePendingActionComplete,
    ],
  );

  // Loading state - only show initial loading spinner
  if (loading && environments.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Progress />
      </Box>
    );
  }

  return (
    <EnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      <EnvironmentsRouter />
    </EnvironmentsProvider>
  );
};
