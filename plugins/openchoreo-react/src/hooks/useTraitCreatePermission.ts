import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoTraitCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useTraitCreatePermission hook.
 */
export interface UseTraitCreatePermissionResult {
  /** Whether the user has permission to create a trait */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create traits.
 *
 * This is an org-level permission (no resource context required).
 * For entity-level trait view permission, see useTraitsPermission.
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useTraitCreatePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Trait</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useTraitCreatePermission = (): UseTraitCreatePermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoTraitCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create a trait'
        : '',
  };
};
