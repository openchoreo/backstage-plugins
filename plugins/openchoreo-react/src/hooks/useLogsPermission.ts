import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoLogsViewPermission } from '@openchoreo/backstage-plugin-common';

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
 * @example
 * ```tsx
 * const { canViewLogs, loading, deniedTooltip } = useLogsPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canViewLogs}>View Logs</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useLogsPermission = (): UseLogsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoLogsViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  const deniedTooltip =
    !allowed && !loading
      ? `You do not have permission to view logs of this ${scope}.`
      : '';

  return {
    canViewLogs: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoLogsViewPermission.name,
  };
};
