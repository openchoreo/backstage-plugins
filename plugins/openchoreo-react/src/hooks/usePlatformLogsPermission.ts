import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoPlatformLogsViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the usePlatformLogsPermission hook.
 */
export interface UsePlatformLogsPermissionResult {
  /** Whether the user has permission to view platform logs */
  canViewPlatformLogs: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking whether the current user may view platform (system component) logs.
 *
 * Unlike `useLogsPermission`, this is cluster-scoped and takes no entity: platform logs
 * are not owned by a project or component, so there is nothing to scope the check to and
 * no `EntityProvider` is required. It is an operator-level permission - it reads every
 * log the observability plane holds - so it is expected to be denied for most users.
 *
 * @example
 * ```tsx
 * const { canViewPlatformLogs, loading, deniedTooltip } = usePlatformLogsPermission();
 * ```
 */
export const usePlatformLogsPermission =
  (): UsePlatformLogsPermissionResult => {
    const { allowed, loading } = usePermission({
      permission: openchoreoPlatformLogsViewPermission,
    });

    const deniedTooltip =
      !allowed && !loading
        ? 'You do not have permission to view platform logs.'
        : '';

    return {
      canViewPlatformLogs: allowed,
      loading,
      deniedTooltip,
      permissionName: openchoreoPlatformLogsViewPermission.name,
    };
  };
