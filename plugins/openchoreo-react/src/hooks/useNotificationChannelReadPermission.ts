import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoNotificationChannelReadPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useNotificationChannelReadPermission hook.
 */
export interface UseNotificationChannelReadPermissionResult {
  /** Whether the user has permission to view notification channels */
  canViewNotificationChannels: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view notification channels.
 *
 * This is an org-level permission (no resource context required).
 */
export const useNotificationChannelReadPermission =
  (): UseNotificationChannelReadPermissionResult => {
    const { allowed: canViewNotificationChannels, loading } = usePermission({
      permission: openchoreoNotificationChannelReadPermission,
    });

    const deniedTooltip =
      !canViewNotificationChannels && !loading
        ? 'You do not have permission to view notification channels.'
        : '';

    return {
      canViewNotificationChannels,
      loading,
      deniedTooltip,
      permissionName: openchoreoNotificationChannelReadPermission.name,
    };
  };
