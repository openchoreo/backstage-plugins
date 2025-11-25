import { useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import {
  promoteToEnvironment,
  deleteReleaseBinding,
} from '../../../api/environments';
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
  discovery: DiscoveryApi,
  identityApi: IdentityApi,
  refetch: () => void,
  notification: UseNotificationHook,
  refreshTracker: ItemActionTracker,
) {
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
      await promoteToEnvironment(
        entity,
        discovery,
        identityApi,
        sourceEnvName.toLowerCase(),
        targetEnvName.toLowerCase(),
      );
      await refetch();
      notification.showSuccess(
        `Component promoted from ${sourceEnvName} to ${targetEnvName}`,
      );
    },
    [entity, discovery, identityApi, refetch, notification],
  );

  const handleSuspend = useCallback(
    async (envName: string) => {
      await deleteReleaseBinding(
        entity,
        discovery,
        identityApi,
        envName.toLowerCase(),
      );
      await refetch();
      notification.showSuccess(
        `Component suspended from ${envName} successfully`,
      );
    },
    [entity, discovery, identityApi, refetch, notification],
  );

  return {
    handleRefreshEnvironment,
    handlePromote,
    handleSuspend,
  };
}
