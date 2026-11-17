import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoEndpointReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useEndpointReleaseBindingUpdatePermission hook.
 */
export interface UseEndpointReleaseBindingUpdatePermissionResult {
  /** Whether the user has permission to mutate the endpoint release binding */
  canUpdate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `endpointreleasebinding:update` on the current Endpoint
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates buttons that mutate an existing EndpointReleaseBinding without
 * creating or deleting it: Promote (advance release pin) and Configure
 * overrides.
 *
 * Independent of the component and resource binding permissions, so a PE can
 * grant Endpoint-only authority without also granting either of those.
 *
 * Must be used within an EntityProvider context.
 */
export const useEndpointReleaseBindingUpdatePermission = (
  environment?: string,
): UseEndpointReleaseBindingUpdatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoEndpointReleaseBindingUpdatePermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to modify the binding in ${environment}`
      : 'You do not have permission to modify the binding';
  }

  return {
    canUpdate: allowed,
    loading,
    deniedTooltip,
  };
};
