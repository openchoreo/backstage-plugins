import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoAuditLogsViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useAuditLogsPermission hook.
 */
export interface UseAuditLogsPermissionResult {
  /** Whether the user has permission to read the audit trail */
  canViewAuditLogs: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking whether the current user may read the audit trail.
 *
 * Cluster-scoped (no resource context): the trail spans every namespace, so
 * reading it is a privilege in its own right rather than something a
 * project-scoped observability grant carries.
 */
export const useAuditLogsPermission = (): UseAuditLogsPermissionResult => {
  const { allowed, loading } = usePermission({
    permission: openchoreoAuditLogsViewPermission,
  });

  return {
    canViewAuditLogs: allowed,
    loading,
    deniedTooltip:
      !allowed && !loading
        ? 'You do not have permission to read the audit trail'
        : '',
    permissionName: openchoreoAuditLogsViewPermission.name,
  };
};
