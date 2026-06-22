import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoProjectTypeCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useProjectTypePermission hook.
 */
export interface UseProjectTypePermissionResult {
  /** Whether the user has permission to create a project type */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create project types.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useProjectTypePermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Project Type</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useProjectTypePermission = (): UseProjectTypePermissionResult => {
  const { allowed: canCreate, loading } = usePermission({
    permission: openchoreoProjectTypeCreatePermission,
  });

  return {
    canCreate,
    loading,
    createDeniedTooltip:
      !canCreate && !loading
        ? 'You do not have permission to create a project type'
        : '',
  };
};
