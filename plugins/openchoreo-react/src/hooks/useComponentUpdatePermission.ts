import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentUpdatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useComponentUpdatePermission hook.
 */
export interface UseComponentUpdatePermissionResult {
  /** Whether the user has permission to update a component */
  canUpdateComponent: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Hook for checking if the current user has permission to update
 * component configuration for the current entity.
 *
 * Must be used within an EntityProvider context.
 */
export const useComponentUpdatePermission =
  (): UseComponentUpdatePermissionResult => {
    const { entity } = useEntity();
    const { allowed, loading } = usePermission({
      permission: openchoreoComponentUpdatePermission,
      resourceRef: stringifyEntityRef(entity),
    });

    return {
      canUpdateComponent: allowed,
      loading,
    };
  };
