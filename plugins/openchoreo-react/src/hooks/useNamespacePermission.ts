import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoNamespaceReadPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useNamespacePermission hook.
 */
export interface UseNamespacePermissionResult {
  /** Whether the user has permission to view namespace/platform details */
  canView: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for view permission denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to view namespace/platform details.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canView, loading } = useNamespacePermission();
 *
 * if (loading) return <Skeleton />;
 * if (!canView) return null;
 * return <HomePagePlatformDetailsCard />;
 * ```
 */
export const useNamespacePermission = (): UseNamespacePermissionResult => {
  const { allowed: canView, loading } = usePermission({
    permission: openchoreoNamespaceReadPermission,
  });

  return {
    canView,
    loading,
    deniedTooltip:
      !canView && !loading
        ? 'You do not have permission to view platform details'
        : '',
  };
};
