import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { Environment } from './hooks/useEnvironmentData';
import {
  promoteToEnvironment,
  deleteReleaseBinding,
} from '../../api/environments';
import { ItemActionTracker } from './types';

interface UseNotificationHook {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

/**
 * Hook for managing stale environment data during refreshes
 * Shows cached data while new data is loading
 */
export function useStaleEnvironments(environments: Environment[]) {
  const [staleEnvironments, setStaleEnvironments] = useState<Environment[]>([]);

  useEffect(() => {
    if (environments.length > 0) {
      setStaleEnvironments(environments);
    }
  }, [environments]);

  const displayEnvironments =
    staleEnvironments.length > 0 ? staleEnvironments : environments;

  const isPending = displayEnvironments.some(
    env => env.deployment.status === 'NotReady',
  );

  return { displayEnvironments, isPending };
}

/**
 * Hook for polling environments when deployments are pending
 */
export function useEnvironmentPolling(isPending: boolean, refetch: () => void) {
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPending) {
      intervalId = setInterval(() => {
        refetch();
      }, 10000); // 10 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPending, refetch]);
}

/**
 * Hook for environment action handlers (promote, suspend, refresh)
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

/**
 * Check if source environment has already been promoted to target
 */
export function isAlreadyPromoted(
  sourceEnv: Environment,
  targetEnvName: string,
  allEnvironments: Environment[],
): boolean {
  const targetEnv = allEnvironments.find(e => e.name === targetEnvName);

  if (!sourceEnv.deployment.releaseName || !targetEnv?.deployment.releaseName) {
    return false;
  }

  return sourceEnv.deployment.releaseName === targetEnv.deployment.releaseName;
}
