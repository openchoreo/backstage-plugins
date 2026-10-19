import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoEndpointReleaseBindingCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useEndpointReleaseBindingCreatePermission hook.
 */
export interface UseEndpointReleaseBindingCreatePermissionResult {
  /** Whether the user can create a new EndpointReleaseBinding */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message shown when permission is denied */
  deniedTooltip: string;
}

/**
 * Hook for checking `endpointreleasebinding:create` on the current Endpoint
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates the Deploy button on environments where the Endpoint has no binding
 * yet. Separate from the update permission so a PE can grant the ability to
 * advance an existing binding without granting the ability to bring up new
 * environments.
 */
export const useEndpointReleaseBindingCreatePermission = (
  environment?: string,
): UseEndpointReleaseBindingCreatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoEndpointReleaseBindingCreatePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to deploy to ${environment}`
      : 'You do not have permission to deploy';
  }

  return {
    canCreate: allowed,
    loading,
    deniedTooltip,
  };
};
