import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoResourceReleaseBindingDeletePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useResourceReleaseBindingDeletePermission hook.
 */
export interface UseResourceReleaseBindingDeletePermissionResult {
  /** Whether the user can delete the ResourceReleaseBinding */
  canDelete: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message shown when permission is denied */
  deniedTooltip: string;
}

/**
 * Hook for checking `resourcereleasebinding:delete` on the current Resource
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates the Undeploy button on environments with an existing binding. With
 * `spec.retainPolicy=Retain` the underlying DP-side state may survive after
 * delete, so the UI surfaces this in its confirmation dialog.
 */
export const useResourceReleaseBindingDeletePermission = (
  environment?: string,
): UseResourceReleaseBindingDeletePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoResourceReleaseBindingDeletePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to undeploy from ${environment}`
      : 'You do not have permission to undeploy';
  }

  return {
    canDelete: allowed,
    loading,
    deniedTooltip,
  };
};
