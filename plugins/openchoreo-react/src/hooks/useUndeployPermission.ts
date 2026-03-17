import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useUndeployPermission hook.
 */
export interface UseUndeployPermissionResult {
  /** Whether the user has permission to undeploy */
  canUndeploy: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to undeploy
 * (update release binding) for the current entity.
 *
 * Must be used within an EntityProvider context.
 */
export const useUndeployPermission = (): UseUndeployPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoReleaseBindingUpdatePermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading ? 'You do not have permission to undeploy' : '';

  return {
    canUndeploy: allowed,
    loading,
    deniedTooltip,
  };
};
