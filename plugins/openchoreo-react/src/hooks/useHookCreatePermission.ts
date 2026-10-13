import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoHookCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useHookCreatePermission hook.
 */
export interface UseHookCreatePermissionResult {
  /** Whether the user has permission to create a hook */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create deployment
 * hooks (alpha) in some namespace.
 *
 * Like {@link useTraitCreatePermission} this is an org-level check (no
 * resource context); the API enforces the namespace on submit.
 */
export const useHookCreatePermission = (): UseHookCreatePermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoHookCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create a hook'
        : '',
  };
};
