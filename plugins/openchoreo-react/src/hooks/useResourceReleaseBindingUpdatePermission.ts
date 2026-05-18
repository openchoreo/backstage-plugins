import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoResourceReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useResourceReleaseBindingUpdatePermission hook.
 */
export interface UseResourceReleaseBindingUpdatePermissionResult {
  /** Whether the user has permission to mutate the resource release binding */
  canUpdate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `resourcereleasebinding:update` on the current Resource
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates buttons that mutate an existing ResourceReleaseBinding without
 * creating or deleting it: Promote (advance release pin), Toggle retainPolicy.
 *
 * Independent of the component-side release-binding permissions, so a PE can
 * grant Resource-only authority without also granting component-binding
 * authority.
 *
 * Must be used within an EntityProvider context.
 */
export const useResourceReleaseBindingUpdatePermission = (
  environment?: string,
): UseResourceReleaseBindingUpdatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoResourceReleaseBindingUpdatePermission,
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
