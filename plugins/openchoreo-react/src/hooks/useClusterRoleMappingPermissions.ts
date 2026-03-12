import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoClusterRoleMappingViewPermission,
  openchoreoClusterRoleMappingCreatePermission,
  openchoreoClusterRoleMappingUpdatePermission,
  openchoreoClusterRoleMappingDeletePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterRoleMappingPermissions hook.
 */
export interface UseClusterRoleMappingPermissionsResult {
  /** Whether the user has permission to view cluster role bindings */
  canView: boolean;
  /** Whether the user has permission to create cluster role bindings */
  canCreate: boolean;
  /** Whether the user has permission to update cluster role bindings */
  canUpdate: boolean;
  /** Whether the user has permission to delete cluster role bindings */
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
 * Hook for checking if the current user has permissions for cluster role binding management.
 *
 * These are org-level permissions (no resource context required).
 */
export const useClusterRoleMappingPermissions =
  (): UseClusterRoleMappingPermissionsResult => {
    const { allowed: canView, loading: viewLoading } = usePermission({
      permission: openchoreoClusterRoleMappingViewPermission,
    });

    const { allowed: canCreate, loading: createLoading } = usePermission({
      permission: openchoreoClusterRoleMappingCreatePermission,
    });

    const { allowed: canUpdate, loading: updateLoading } = usePermission({
      permission: openchoreoClusterRoleMappingUpdatePermission,
    });

    const { allowed: canDelete, loading: deleteLoading } = usePermission({
      permission: openchoreoClusterRoleMappingDeletePermission,
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
          ? 'You do not have permission to view cluster role bindings'
          : '',
      createDeniedTooltip:
        !canCreate && !createLoading
          ? 'You do not have permission to create cluster role bindings'
          : '',
      updateDeniedTooltip:
        !canUpdate && !updateLoading
          ? 'You do not have permission to edit cluster role bindings'
          : '',
      deleteDeniedTooltip:
        !canDelete && !deleteLoading
          ? 'You do not have permission to delete cluster role bindings'
          : '',
    };
  };
