import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoEndpointReleaseBindingDeletePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useEndpointReleaseBindingDeletePermission hook.
 */
export interface UseEndpointReleaseBindingDeletePermissionResult {
  /** Whether the user can delete the EndpointReleaseBinding */
  canDelete: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message shown when permission is denied */
  deniedTooltip: string;
}

/**
 * Hook for checking `endpointreleasebinding:delete` on the current Endpoint
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates the Remove deployment button on environments with an existing
 * binding. Deleting the binding removes the Endpoint's routes from that
 * environment.
 */
export const useEndpointReleaseBindingDeletePermission = (
  environment?: string,
): UseEndpointReleaseBindingDeletePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoEndpointReleaseBindingDeletePermission,
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
