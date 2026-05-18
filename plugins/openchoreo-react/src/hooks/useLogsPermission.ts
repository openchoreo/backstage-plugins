import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoLogsViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useLogsPermission hook.
 */
export interface UseLogsPermissionResult {
  /** Whether the user has permission to view logs */
  canViewLogs: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view logs
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints (issue #3408).
 */
export const useLogsPermission = (
  environment?: string,
): UseLogsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoLogsViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view logs in ${environment}.`
      : `You do not have permission to view logs of this ${scope}.`;
  }

  return {
    canViewLogs: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoLogsViewPermission.name,
  };
};
