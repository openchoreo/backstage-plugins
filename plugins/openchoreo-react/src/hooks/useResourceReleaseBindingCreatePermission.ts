import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoResourceReleaseBindingCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useResourceReleaseBindingCreatePermission hook.
 */
export interface UseResourceReleaseBindingCreatePermissionResult {
  /** Whether the user can create a new ResourceReleaseBinding */
  canCreate: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message shown when permission is denied */
  deniedTooltip: string;
}

/**
 * Hook for checking `resourcereleasebinding:create` on the current Resource
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints.
 *
 * Gates the Deploy button on environments where the Resource has no binding
 * yet. Separate from the update permission so a PE can grant the ability to
 * advance an existing binding without granting the ability to bring up new
 * environments.
 */
export const useResourceReleaseBindingCreatePermission = (
  environment?: string,
): UseResourceReleaseBindingCreatePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoResourceReleaseBindingCreatePermission,
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
