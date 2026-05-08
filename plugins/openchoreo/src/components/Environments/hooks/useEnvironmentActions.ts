import { useCallback, useEffect, useRef } from 'react';
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

  // Tracks whether the consumer component is still mounted. Long-running
  // handlers (e.g. handleRemoveDeployment's poll loop) check this before
  // firing post-completion side effects so we don't call refetch / show
  // a toast on a torn-down component.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
  //
  // After DELETE, the binding is gone but dataplane teardown is async —
  // /deploy may still report the env as Ready for several seconds. Poll
  // fetchEnvironmentInfo until the env's binding is gone (or it drops
  // out of the list), then refetch so the page re-renders. Bound the
  // wait so a stuck controller surfaces a softer message instead of
  // hanging forever.
  const handleRemoveDeployment = useCallback(
    async (_bindingName: string, envName: string) => {
      await client.deleteReleaseBinding(entity, envName);

      const POLL_INTERVAL_MS = 1500;
      const POLL_TIMEOUT_MS = 15_000;
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let confirmed = false;
      while (Date.now() < deadline && mountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        if (!mountedRef.current) break;
        try {
          const envs = (await client.fetchEnvironmentInfo(entity)) as Array<{
            name: string;
            resourceName?: string;
            bindingName?: string;
          }>;
          const match = envs.find(e => (e.resourceName ?? e.name) === envName);
          if (!match || !match.bindingName) {
            confirmed = true;
            break;
          }
        } catch {
          // Transient fetch failure during reconcile — keep polling
          // until the deadline.
        }
      }

      if (!mountedRef.current) return;
      await refetch();
      if (confirmed) {
        notification.showSuccess(`Deployment removed from ${envName}`);
      } else {
        notification.showSuccess(
          `Removal of ${envName} accepted — UI may take a moment to catch up`,
        );
      }
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
