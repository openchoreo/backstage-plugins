import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useUndeployPermission hook.
 */
export interface UseUndeployPermissionResult {
  /** Whether the user has permission to undeploy */
  canUndeploy: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to undeploy
 * (update release binding) for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints. See openchoreo
 *   issue #3408.
 */
export const useUndeployPermission = (
  environment?: string,
): UseUndeployPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingUpdatePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to undeploy from ${environment}`
      : 'You do not have permission to undeploy';
  }

  return {
    canUndeploy: allowed,
    loading,
    deniedTooltip,
  };
};
