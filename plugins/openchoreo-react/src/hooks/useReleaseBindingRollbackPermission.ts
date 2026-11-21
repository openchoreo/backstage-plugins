import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingRollbackPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useReleaseBindingRollbackPermission hook.
 */
export interface UseReleaseBindingRollbackPermissionResult {
  /** Whether the user may roll the release binding back */
  canRollback: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `releasebinding:rollback` on the current entity,
 * optionally scoped to an environment for ABAC `resource.environment` CEL
 * constraints. Gates the Roll back action in the revision history.
 *
 * Must be used within an EntityProvider context.
 */
export const useReleaseBindingRollbackPermission = (
  environment?: string,
): UseReleaseBindingRollbackPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingRollbackPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to roll back the deployment in ${environment}`
      : 'You do not have permission to roll back the deployment';
  }

  return {
    canRollback: allowed,
    loading,
    deniedTooltip,
  };
};
