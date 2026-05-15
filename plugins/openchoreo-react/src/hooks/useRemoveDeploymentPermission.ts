import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingDeletePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useRemoveDeploymentPermission hook.
 */
export interface UseRemoveDeploymentPermissionResult {
  /** Whether the user has permission to remove the deployment */
  canRemoveDeployment: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `releasebinding:delete` — gates the "Remove deployment"
 * danger-zone button. Resource-scoped permission, optionally narrowed to a
 * specific environment for ABAC `resource.environment` CEL constraints.
 *
 * Must be used within an EntityProvider context.
 */
export const useRemoveDeploymentPermission = (
  environment?: string,
): UseRemoveDeploymentPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingDeletePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to remove the deployment in ${environment}`
      : 'You do not have permission to remove the deployment';
  }

  return {
    canRemoveDeployment: allowed,
    loading,
    deniedTooltip,
  };
};
