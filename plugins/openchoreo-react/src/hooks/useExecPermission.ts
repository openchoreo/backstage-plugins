import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoExecPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useExecPermission hook.
 */
export interface UseExecPermissionResult {
  /** Whether the user has permission to exec into component pods */
  canExec: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to exec into a running
 * pod for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints, allowing platform
 *   engineers to restrict exec access to specific environments.
 */
export const useExecPermission = (
  environment?: string,
): UseExecPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoExecPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to exec into this component in ${environment}.`
      : `You do not have permission to exec into this component.`;
  }

  return {
    canExec: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoExecPermission.name,
  };
};
