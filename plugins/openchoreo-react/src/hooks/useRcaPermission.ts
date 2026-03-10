import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoRcaViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useRcaPermission hook.
 */
export interface UseRcaPermissionResult {
  /** Whether the user has permission to view RCA reports */
  canViewRca: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

export const useRcaPermission = (): UseRcaPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoRcaViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading
      ? 'You do not have permission to view RCA reports.'
      : '';

  return {
    canViewRca: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoRcaViewPermission.name,
  };
};
