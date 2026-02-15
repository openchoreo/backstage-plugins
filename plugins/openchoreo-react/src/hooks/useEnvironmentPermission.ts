import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoEnvironmentCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useEnvironmentPermission hook.
 */
export interface UseEnvironmentPermissionResult {
  /** Whether the user has permission to create an environment */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create environments.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useEnvironmentPermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Environment</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useEnvironmentPermission = (): UseEnvironmentPermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoEnvironmentCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create an environment'
        : '',
  };
};
