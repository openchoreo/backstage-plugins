import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoFinopsUpdatePermission } from '@openchoreo/backstage-plugin-common';

export interface UseFinopsUpdatePermissionResult {
  /** Whether the user has permission to apply/dismiss FinOps recommendations */
  canUpdateFinops: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

export const useFinopsUpdatePermission =
  (): UseFinopsUpdatePermissionResult => {
    const { entity } = useEntity();
    const { allowed, loading } = usePermission({
      permission: openchoreoFinopsUpdatePermission,
      resourceRef: stringifyEntityRef(entity),
    });

    const deniedTooltip =
      !allowed && !loading
        ? 'You do not have permission to apply FinOps recommendations.'
        : '';

    return {
      canUpdateFinops: allowed,
      loading,
      deniedTooltip,
      permissionName: openchoreoFinopsUpdatePermission.name,
    };
  };
