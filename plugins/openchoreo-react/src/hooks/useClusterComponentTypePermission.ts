import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterComponentTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterComponentTypePermission hook.
 */
export interface UseClusterComponentTypePermissionResult {
  /** Whether the user has permission to create a cluster component type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster component types.
 *
 * This is a cluster-scoped permission (no namespace context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useClusterComponentTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Cluster Component Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useClusterComponentTypePermission =
  (): UseClusterComponentTypePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterComponentTypeCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster component type'
          : '',
    };
  };
