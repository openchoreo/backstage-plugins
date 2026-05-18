import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoTracesViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useTracesPermission hook.
 */
export interface UseTracesPermissionResult {
  /** Whether the user has permission to view traces */
  canViewTraces: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view traces
 * for the current entity.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints (issue #3408).
 */
export const useTracesPermission = (
  environment?: string,
): UseTracesPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoTracesViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view traces in ${environment}.`
      : 'You do not have permission to view traces.';
  }

  return {
    canViewTraces: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoTracesViewPermission.name,
  };
};
