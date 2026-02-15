import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoNamespaceReadPermission,
  openchoreoNamespaceCreatePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useNamespacePermission hook.
 */
export interface UseNamespacePermissionResult {
  /** Whether the user has permission to view namespace/platform details */
  canView: boolean;
  /** Whether the user has permission to create a namespace */
  canCreate: boolean;
  /** Whether any permission check is still loading */
  loading: boolean;
  /** Tooltip message for view permission denied (empty string when allowed/loading) */
  viewDeniedTooltip: string;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has namespace/platform permissions.
 *
 * This is an org-level permission (no resource context required).
 *
 * @example
 * ```tsx
 * const { canView, canCreate, loading } = useNamespacePermission();
 *
 * if (loading) return <Skeleton />;
 * if (!canView) return null;
 * return <HomePagePlatformDetailsCard />;
 * ```
 */
export const useNamespacePermission = (): UseNamespacePermissionResult => {
  const { allowed: canView, loading: viewLoading } = usePermission({
    permission: openchoreoNamespaceReadPermission,
  });

  const { allowed: canCreate, loading: createLoading } = usePermission({
    permission: openchoreoNamespaceCreatePermission,
  });

  const loading = viewLoading || createLoading;

  return {
    canView,
    canCreate,
    loading,
    viewDeniedTooltip:
      !canView && !viewLoading
        ? 'You do not have permission to view platform details'
        : '',
    createDeniedTooltip:
      !canCreate && !createLoading
        ? 'You do not have permission to create a namespace'
        : '',
  };
};
