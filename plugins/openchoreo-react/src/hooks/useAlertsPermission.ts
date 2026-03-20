import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoAlertsViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useAlertsPermission hook.
 */
export interface UseAlertsPermissionResult {
  /** Whether the user has permission to view alerts */
  canViewAlerts: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view alerts
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canViewAlerts, loading, deniedTooltip } = useAlertsPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canViewAlerts}>View Alerts</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useAlertsPermission = (): UseAlertsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoAlertsViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  const deniedTooltip =
    !allowed && !loading
      ? `You do not have permission to view alerts of this ${scope}.`
      : '';

  return {
    canViewAlerts: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoAlertsViewPermission.name,
  };
};
