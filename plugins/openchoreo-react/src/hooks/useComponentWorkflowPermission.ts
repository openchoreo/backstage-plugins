import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentWorkflowCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useComponentWorkflowPermission hook.
 */
export interface UseComponentWorkflowPermissionResult {
  /** Whether the user has permission to create a component workflow */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create component workflows.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canCreate, loading, createDeniedTooltip } = useComponentWorkflowPermission();
 *
 * return (
 *   <Tooltip title={createDeniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canCreate}>New Workflow</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useComponentWorkflowPermission =
  (): UseComponentWorkflowPermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoComponentWorkflowCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a component workflow'
          : '',
    };
  };
