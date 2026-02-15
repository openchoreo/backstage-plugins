import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoProjectCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useProjectPermission hook.
 */
export interface UseProjectPermissionResult {
  /** Whether the user has permission to create a project */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create projects.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useProjectPermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Project</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useProjectPermission = (): UseProjectPermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoProjectCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create a project'
        : '',
  };
};
