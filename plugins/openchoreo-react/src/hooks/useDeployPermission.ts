import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useDeployPermission hook.
 */
export interface UseDeployPermissionResult {
  /** Whether the user has permission to deploy */
  canDeploy: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to deploy
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints (see issue
 *   openchoreo#3408). When omitted, this behaves like a plain visibility
 *   check — useful for "can the user deploy *somewhere*?" gates.
 *
 * @example
 * ```tsx
 * const { canDeploy, loading, deniedTooltip } = useDeployPermission(env.name);
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canDeploy}>Deploy</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useDeployPermission = (
  environment?: string,
): UseDeployPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingCreatePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to deploy to ${environment}`
      : 'You do not have permission to deploy';
  }

  return {
    canDeploy: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoReleaseBindingCreatePermission.name,
  };
};
