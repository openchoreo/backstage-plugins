import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useComponentTypePermission hook.
 */
export interface UseComponentTypePermissionResult {
  /** Whether the user has permission to create a component type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create component types.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useComponentTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Component Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useComponentTypePermission =
  (): UseComponentTypePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoComponentTypeCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a component type'
          : '',
    };
  };
