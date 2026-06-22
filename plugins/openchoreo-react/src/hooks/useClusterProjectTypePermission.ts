import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterProjectTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterProjectTypePermission hook.
 */
export interface UseClusterProjectTypePermissionResult {
  /** Whether the user has permission to create a cluster project type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster project types.
 *
 * This is a cluster-scoped permission (no namespace context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useClusterProjectTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Cluster Project Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useClusterProjectTypePermission =
  (): UseClusterProjectTypePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterProjectTypeCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster project type'
          : '',
    };
  };
