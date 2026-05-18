import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoResourceTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useResourceTypePermission hook.
 */
export interface UseResourceTypePermissionResult {
  /** Whether the user has permission to create a resource type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create resource types.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useResourceTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Resource Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useResourceTypePermission =
  (): UseResourceTypePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoResourceTypeCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a resource type'
          : '',
    };
  };
