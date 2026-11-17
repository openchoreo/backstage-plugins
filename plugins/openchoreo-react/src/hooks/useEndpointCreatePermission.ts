import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoEndpointCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useEndpointCreatePermission hook.
 */
export interface UseEndpointCreatePermissionResult {
  /** Whether the user has permission to create an endpoint */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create endpoints.
 *
 * This is a project-level permission. The actual project scope is resolved
 * server-side by the policy backend when the request lands.
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useEndpointCreatePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Endpoint</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useEndpointCreatePermission =
  (): UseEndpointCreatePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoEndpointCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create an endpoint'
          : '',
    };
  };
