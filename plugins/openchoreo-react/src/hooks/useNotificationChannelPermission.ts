import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoNotificationChannelCreatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useNotificationChannelPermission hook.
 */
export interface UseNotificationChannelPermissionResult {
  /** Whether the user has permission to create a notification channel */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message for create permission denied (empty string when allowed/loading) */
  createDeniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to create notification channels.
 *
 * This is an org-level permission (no resource context required).
 */
export const useNotificationChannelPermission =
  (): UseNotificationChannelPermissionResult => {
    const { allowed: canCreate, loading } = usePermission({
      permission: openchoreoNotificationChannelCreatePermission,
    });

    return {
      canCreate,
      loading,
      createDeniedTooltip:
        !canCreate && !loading
          ? 'You do not have permission to create a notification channel'
          : '',
    };
  };
