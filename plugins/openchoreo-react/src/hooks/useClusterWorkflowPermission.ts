import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterWorkflowCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterWorkflowPermission hook.
 */
export interface UseClusterWorkflowPermissionResult {
  /** Whether the user has permission to create a cluster workflow */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster workflows.
 *
 * This is a cluster-scoped permission (no namespace context required).
 */
export const useClusterWorkflowPermission =
  (): UseClusterWorkflowPermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterWorkflowCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster workflow'
          : '',
    };
  };
