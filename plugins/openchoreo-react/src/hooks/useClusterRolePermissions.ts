import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoClusterRoleViewPermission,
  openchoreoClusterRoleCreatePermission,
  openchoreoClusterRoleUpdatePermission,
  openchoreoClusterRoleDeletePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterRolePermissions hook.
 */
export interface UseClusterRolePermissionsResult {
  /** Whether the user has permission to view cluster roles */
  canView: boolean;
  /** Whether the user has permission to create cluster roles */
  canCreate: boolean;
  /** Whether the user has permission to update cluster roles */
  canUpdate: boolean;
  /** Whether the user has permission to delete cluster roles */
  canDelete: boolean;
  /** Whether any permission check is still loading */
  loading: boolean;
  /** Tooltip message for view permission denied (empty string when allowed/loading) */
  viewDeniedTooltip: string;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
  /** Tooltip message for update permission denied (empty string when allowed/loading) */
  updateDeniedTooltip: string;
  /** Tooltip message for delete permission denied (empty string when allowed/loading) */
  deleteDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permissions for cluster role management.
 *
 * These are org-level permissions (no resource context required).
 */
export const useClusterRolePermissions =
  (): UseClusterRolePermissionsResult => {
    const { allowed: canView, loading: viewLoading } = usePermission({
      permission: openchoreoClusterRoleViewPermission,
    });

    const { allowed: canCreate, loading: createLoading } = usePermission({
      permission: openchoreoClusterRoleCreatePermission,
    });

    const { allowed: canUpdate, loading: updateLoading } = usePermission({
      permission: openchoreoClusterRoleUpdatePermission,
    });

    const { allowed: canDelete, loading: deleteLoading } = usePermission({
      permission: openchoreoClusterRoleDeletePermission,
    });

    const loading =
      viewLoading || createLoading || updateLoading || deleteLoading;

    return {
      canView,
      canCreate,
      canUpdate,
      canDelete,
      loading,
      viewDeniedTooltip:
        !canView && !viewLoading
          ? 'You do not have permission to view cluster roles'
          : '',
      createDeniedTooltip:
        !canCreate && !createLoading
          ? 'You do not have permission to create cluster roles'
          : '',
      updateDeniedTooltip:
        !canUpdate && !updateLoading
          ? 'You do not have permission to edit cluster roles'
          : '',
      deleteDeniedTooltip:
        !canDelete && !deleteLoading
          ? 'You do not have permission to delete cluster roles'
          : '',
    };
  };
