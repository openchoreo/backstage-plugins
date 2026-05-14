import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useReleaseBindingUpdatePermission hook.
 */
export interface UseReleaseBindingUpdatePermissionResult {
  /** Whether the user has permission to mutate the release binding */
  canUpdate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `releasebinding:update` on the current entity, optionally
 * scoped to an environment for ABAC `resource.environment` CEL constraints.
 *
 * Gates buttons that mutate an existing release binding without creating or
 * deleting it: Configure overrides (edit), Undeploy (lifecycle change),
 * Rollout restart.
 *
 * The pre-existing `useUndeployPermission` is a named alias of this hook and
 * is kept exported so existing call sites continue to work — both names map
 * to the same `openchoreoReleaseBindingUpdatePermission`.
 *
 * Must be used within an EntityProvider context.
 */
export const useReleaseBindingUpdatePermission = (
  environment?: string,
): UseReleaseBindingUpdatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingUpdatePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to modify the deployment in ${environment}`
      : 'You do not have permission to modify the deployment';
  }

  return {
    canUpdate: allowed,
    loading,
    deniedTooltip,
  };
};
