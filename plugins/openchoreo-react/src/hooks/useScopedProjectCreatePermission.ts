import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoProjectCreateScopedPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useScopedProjectCreatePermission hook.
 */
export interface UseScopedProjectCreatePermissionResult {
  /** Whether the user has permission to create a project in this scope */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create projects
 * within the scope of the current entity (namespace).
 *
 * Unlike `useProjectPermission` (basic/global), this hook is resource-based
 * and evaluates deny paths against the entity's scope. Use this on namespace
 * pages where a namespace-level deny policy should disable the
 * "Create Project" button.
 *
 * Must be used within an EntityProvider context.
 */
export const useScopedProjectCreatePermission =
  (): UseScopedProjectCreatePermissionResult => {
    const { entity } = useEntity();
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoProjectCreateScopedPermission,
      resourceRef: stringifyEntityRef(entity),
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a project in this namespace'
          : '',
    };
  };
