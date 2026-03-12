import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoDeploymentpipelineCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useDeploymentPipelinePermission hook.
 */
export interface UseDeploymentPipelinePermissionResult {
  /** Whether the user has permission to create a deployment pipeline */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create deployment pipelines.
 *
 * This is an org-level permission (no resource context required).
 */
export const useDeploymentPipelinePermission =
  (): UseDeploymentPipelinePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoDeploymentpipelineCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a deployment pipeline'
          : '',
    };
  };
