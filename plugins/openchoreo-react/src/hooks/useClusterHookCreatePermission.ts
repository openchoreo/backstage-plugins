import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterHookCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterHookCreatePermission hook.
 */
export interface UseClusterHookCreatePermissionResult {
  /** Whether the user has permission to create a cluster hook */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster
 * deployment hooks (alpha).
 *
 * This is a cluster-scoped permission (no namespace context required).
 */
export const useClusterHookCreatePermission =
  (): UseClusterHookCreatePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterHookCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster hook'
          : '',
    };
  };
