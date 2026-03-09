import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoReleaseBindingReadPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useReleaseBindingPermission hook.
 */
export interface UseReleaseBindingPermissionResult {
  /** Whether the user has permission to view release bindings */
  canViewBindings: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Hook for checking if the current user has permission to view release bindings.
 *
 * This is an org-level permission (no resource context required).
 */
export const useReleaseBindingPermission =
  (): UseReleaseBindingPermissionResult => {
    const { allowed: canViewBindings, loading } = usePermission({
      permission: openchoreoReleaseBindingReadPermission,
    });

    return { canViewBindings, loading };
  };
