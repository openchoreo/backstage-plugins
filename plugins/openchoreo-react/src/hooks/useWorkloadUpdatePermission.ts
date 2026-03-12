import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoWorkloadUpdatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useWorkloadUpdatePermission hook.
 */
export interface UseWorkloadUpdatePermissionResult {
  /** Whether the user has permission to update workload configuration */
  canUpdateWorkload: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Hook for checking if the current user has permission to update
 * workload configuration for the current entity.
 *
 * Must be used within an EntityProvider context.
 */
export const useWorkloadUpdatePermission =
  (): UseWorkloadUpdatePermissionResult => {
    const { entity } = useEntity();
    const { allowed, loading } = usePermission({
      permission: openchoreoWorkloadUpdatePermission,
      resourceRef: stringifyEntityRef(entity),
    });

    return {
      canUpdateWorkload: allowed,
      loading,
    };
  };
