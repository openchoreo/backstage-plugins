import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoResourceCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useResourceCreatePermission hook.
 */
export interface UseResourceCreatePermissionResult {
  /** Whether the user has permission to create a resource */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create resources.
 *
 * This is a project-level permission. The actual project scope is resolved
 * server-side by the policy backend when the request lands.
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useResourceCreatePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Resource</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useResourceCreatePermission =
  (): UseResourceCreatePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoResourceCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a resource'
          : '',
    };
  };
