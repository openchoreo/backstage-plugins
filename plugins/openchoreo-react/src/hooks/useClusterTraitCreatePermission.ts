import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoClusterTraitCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useClusterTraitCreatePermission hook.
 */
export interface UseClusterTraitCreatePermissionResult {
  /** Whether the user has permission to create a cluster trait */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create cluster traits.
 *
 * This is a cluster-scoped permission (no namespace context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useClusterTraitCreatePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Cluster Trait</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useClusterTraitCreatePermission =
  (): UseClusterTraitCreatePermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoClusterTraitCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a cluster trait'
          : '',
    };
  };
