import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoRoleMappingViewPermission,
  openchoreoRoleMappingCreatePermission,
  openchoreoRoleMappingUpdatePermission,
  openchoreoRoleMappingDeletePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useRoleMappingPermissions hook.
 */
export interface UseRoleMappingPermissionsResult {
  /** Whether the user has permission to view role mappings */
  canView: boolean;
  /** Whether the user has permission to create role mappings */
  canCreate: boolean;
  /** Whether the user has permission to update role mappings */
  canUpdate: boolean;
  /** Whether the user has permission to delete role mappings */
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
 * Hook for checking if the current user has permissions for role mapping management.
 *
 * These are org-level permissions (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, canUpdate, canDelete, loading, createDeniedTooltip } = useRoleMappingPermissions();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Mapping</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useRoleMappingPermissions =
  (): UseRoleMappingPermissionsResult => {
    const { allowed: canView, loading: viewLoading } = usePermission({
      permission: openchoreoRoleMappingViewPermission,
    });

    const { allowed: canCreate, loading: createLoading } = usePermission({
      permission: openchoreoRoleMappingCreatePermission,
    });

    const { allowed: canUpdate, loading: updateLoading } = usePermission({
      permission: openchoreoRoleMappingUpdatePermission,
    });

    const { allowed: canDelete, loading: deleteLoading } = usePermission({
      permission: openchoreoRoleMappingDeletePermission,
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
          ? 'You do not have permission to view role mappings'
          : '',
      createDeniedTooltip:
        !canCreate && !createLoading
          ? 'You do not have permission to create role mappings'
          : '',
      updateDeniedTooltip:
        !canUpdate && !updateLoading
          ? 'You do not have permission to edit role mappings'
          : '',
      deleteDeniedTooltip:
        !canDelete && !deleteLoading
          ? 'You do not have permission to delete role mappings'
          : '',
    };
  };
