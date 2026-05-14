import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterResourceTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterResourceTypePermission hook.
 */
export interface UseClusterResourceTypePermissionResult {
  /** Whether the user has permission to create a cluster resource type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster resource types.
 *
 * This is a cluster-scoped permission (no namespace context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useClusterResourceTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Cluster Resource Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useClusterResourceTypePermission =
  (): UseClusterResourceTypePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterResourceTypeCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster resource type'
          : '',
    };
  };
