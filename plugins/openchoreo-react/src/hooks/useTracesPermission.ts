import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoTracesViewPermission } from '@openchoreo/backstage-plugin-common';

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

export const useTracesPermission = (): UseTracesPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoTracesViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading ? 'You do not have permission to view traces.' : '';

  return {
    canViewTraces: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoTracesViewPermission.name,
  };
};
