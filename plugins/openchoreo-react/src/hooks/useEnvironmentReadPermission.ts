import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoEnvironmentReadPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useEnvironmentReadPermission hook.
 */
export interface UseEnvironmentReadPermissionResult {
  /** Whether the user has permission to view environments */
  canViewEnvironments: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Hook for checking if the current user has permission to view environments.
 *
 * This is an org-level permission (no resource context required).
 */
export const useEnvironmentReadPermission =
  (): UseEnvironmentReadPermissionResult => {
    const { allowed: canViewEnvironments, loading } = usePermission({
      permission: openchoreoEnvironmentReadPermission,
    });

    return { canViewEnvironments, loading };
  };
