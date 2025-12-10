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
      await client.promoteToEnvironment(
        entity,
        sourceEnvName.toLowerCase(),
        targetEnvName.toLowerCase(),
      );
      await refetch();
      notification.showSuccess(
        `Component promoted from ${sourceEnvName} to ${targetEnvName}`,
      );
    },
    [entity, client, refetch, notification],
  );

  const handleSuspend = useCallback(
    async (envName: string) => {
      await client.deleteReleaseBinding(entity, envName.toLowerCase());
      await refetch();
      notification.showSuccess(
        `Component suspended from ${envName} successfully`,
      );
    },
    [entity, client, refetch, notification],
  );

  return {
    handleRefreshEnvironment,
    handlePromote,
    handleSuspend,
  };
}
