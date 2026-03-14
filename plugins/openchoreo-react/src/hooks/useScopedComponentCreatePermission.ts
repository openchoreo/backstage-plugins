import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentCreateScopedPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useScopedComponentCreatePermission hook.
 */
export interface UseScopedComponentCreatePermissionResult {
  /** Whether the user has permission to create a component in this scope */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create components
 * within the scope of the current entity (project/namespace).
 *
 * Unlike `useComponentCreatePermission` (basic/global), this hook is
 * resource-based and evaluates deny paths against the entity's scope.
 * Use this on project pages where a project-level deny policy should
 * disable the "Create Component" button.
 *
 * Must be used within an EntityProvider context.
 */
export const useScopedComponentCreatePermission =
  (): UseScopedComponentCreatePermissionResult => {
    const { entity } = useEntity();
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoComponentCreateScopedPermission,
      resourceRef: stringifyEntityRef(entity),
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a component in this project'
          : '',
    };
  };
