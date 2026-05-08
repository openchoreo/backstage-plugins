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

  // Stub: rollout-restart API + reconciliation lands in a follow-up. This
  // handler is wired through the panel today so only the API call is left
  // to swap in.
  const handleRolloutRestart = useCallback(
    async (_bindingName: string) => {
      notification.showError('Rollout restart is not yet wired up');
    },
    [notification],
  );

  // Removing the deployment deletes the release binding for the env;
  // the controller cascades to env-specific overrides and dataplane
  // resources. Different from Undeploy, which keeps the binding.
  // bindingName is unused inside this handler — callers thread it in for
  // the action-tracker key. The API only needs the env name.
  const handleRemoveDeployment = useCallback(
    async (_bindingName: string, envName: string) => {
      await client.deleteReleaseBinding(entity, envName);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refetch();
      notification.showSuccess(`Deployment removed from ${envName}`);
    },
    [entity, client, refetch, notification],
  );

  return {
    handleRefreshEnvironment,
    handlePromote,
    handleUndeploy,
    handleRedeploy,
    handleRolloutRestart,
    handleRemoveDeployment,
  };
}
