import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoWorkflowCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useWorkflowPermission hook.
 */
export interface UseWorkflowPermissionResult {
  /** Whether the user has permission to create a workflow */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create workflows.
 *
 * This is an org-level permission (no resource context required).
 */
export const useWorkflowPermission = (): UseWorkflowPermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoWorkflowCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create a workflow'
        : '',
  };
};
