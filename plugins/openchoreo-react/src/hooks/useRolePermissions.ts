import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoRoleViewPermission,
  openchoreoRoleCreatePermission,
  openchoreoRoleUpdatePermission,
  openchoreoRoleDeletePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useRolePermissions hook.
 */
export interface UseRolePermissionsResult {
  /** Whether the user has permission to view roles */
  canView: boolean;
  /** Whether the user has permission to create roles */
  canCreate: boolean;
  /** Whether the user has permission to update roles */
  canUpdate: boolean;
  /** Whether the user has permission to delete roles */
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
 * Hook for checking if the current user has permissions for role management.
 *
 * These are org-level permissions (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, canUpdate, canDelete, loading, createDeniedTooltip } = useRolePermissions();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Role</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useRolePermissions = (): UseRolePermissionsResult => {
  const { allowed: canView, loading: viewLoading } = usePermission({
    permission: openchoreoRoleViewPermission,
  });

  const { allowed: canCreate, loading: createLoading } = usePermission({
    permission: openchoreoRoleCreatePermission,
  });

  const { allowed: canUpdate, loading: updateLoading } = usePermission({
    permission: openchoreoRoleUpdatePermission,
  });

  const { allowed: canDelete, loading: deleteLoading } = usePermission({
    permission: openchoreoRoleDeletePermission,
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
        ? 'You do not have permission to view roles'
        : '',
    createDeniedTooltip:
      !canCreate && !createLoading
        ? 'You do not have permission to create roles'
        : '',
    updateDeniedTooltip:
      !canUpdate && !updateLoading
        ? 'You do not have permission to edit roles'
        : '',
    deleteDeniedTooltip:
      !canDelete && !deleteLoading
        ? 'You do not have permission to delete roles'
        : '',
  };
};
