import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useComponentCreatePermission hook.
 */
export interface UseComponentCreatePermissionResult {
  /** Whether the user has permission to create a component */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create components.
 *
 * This is an org-level permission (no resource context required).
 * For entity-level component permissions (build, deploy, update), see
 * useBuildPermission, useDeployPermission, etc.
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useComponentCreatePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Component</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useComponentCreatePermission =
  (): UseComponentCreatePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoComponentCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a component'
          : '',
    };
  };
