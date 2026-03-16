import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoProjectUpdatePermission } from '@openchoreo/backstage-plugin-common';

export interface UseProjectUpdatePermissionResult {
  /** Whether the user has permission to update this project */
  canUpdate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for update permission denied (empty string when allowed/loading) */
  updateDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to update the current project.
 *
 * Must be used within an EntityProvider context (project entity page).
 */
export const useProjectUpdatePermission =
  (): UseProjectUpdatePermissionResult => {
    const { entity } = useEntity();
    const { allowed: canUpdate, loading } = usePermission({
      permission: openchoreoProjectUpdatePermission,
      resourceRef: stringifyEntityRef(entity),
    });

    return {
      canUpdate,
      loading,
      updateDeniedTooltip:
        !canUpdate && !loading
          ? 'You do not have permission to update this project'
          : '',
    };
  };
