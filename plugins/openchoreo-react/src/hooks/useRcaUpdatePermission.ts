import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoRcaUpdatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useRcaUpdatePermission hook.
 */
export interface UseRcaUpdatePermissionResult {
  /** Whether the user has permission to update RCA reports (apply/dismiss fixes) */
  canUpdateRca: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

export const useRcaUpdatePermission = (): UseRcaUpdatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoRcaUpdatePermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading
      ? 'You do not have permission to update RCA reports.'
      : '';

  return {
    canUpdateRca: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoRcaUpdatePermission.name,
  };
};
