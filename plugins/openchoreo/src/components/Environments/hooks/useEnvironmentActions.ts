import { useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { ItemActionTracker } from '../types';

interface UseNotificationHook {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

/**
 * Hook for environment action handlers (promote, suspend, refresh).
 * Provides callback functions for common environment operations.
 */
export function useEnvironmentActions(
  entity: Entity,
  refetch: () => void,
  notification: UseNotificationHook,
  refreshTracker: ItemActionTracker,
) {
  const client = useApi(openChoreoClientApiRef);

  const handleRefreshEnvironment = useCallback(
    (envName: string) =>
      refreshTracker.withTracking(envName, async () => {
        await Promise.all([
          refetch(),
          new Promise(resolve => setTimeout(resolve, 300)),
        ]);
      }),
    [refetch, refreshTracker],
  );

  const handlePromote = useCallback(
    async (sourceEnvName: string, targetEnvName: string) => {
      await client.promoteToEnvironment(entity, sourceEnvName, targetEnvName);
      await refetch();
      notification.showSuccess(
        `Component promoted from ${sourceEnvName} to ${targetEnvName}`,
      );
    },
    [entity, client, refetch, notification],
  );

  const handleUndeploy = useCallback(
    async (bindingName: string) => {
      await client.updateComponentBinding(entity, bindingName, 'Undeploy');
      // Small delay to allow the server to reconcile the state change
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch();
      notification.showSuccess(`Component undeployed successfully`);
    },
    [entity, client, refetch, notification],
  );

  const handleRedeploy = useCallback(
    async (bindingName: string) => {
      await client.updateComponentBinding(entity, bindingName, 'Active');
      // Small delay to allow the server to reconcile the state change
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch();
      notification.showSuccess(`Component redeployed successfully`);
    },
    [entity, client, refetch, notification],
  );

  return {
    handleRefreshEnvironment,
    handlePromote,
    handleUndeploy,
    handleRedeploy,
  };
}
