import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoResourceReleaseBindingRollbackPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useResourceReleaseBindingRollbackPermission hook.
 */
export interface UseResourceReleaseBindingRollbackPermissionResult {
  /** Whether the user may roll the resource release binding back */
  canRollback: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `resourcereleasebinding:rollback` on the current Resource
 * entity, optionally scoped to an environment for ABAC `resource.environment`
 * CEL constraints. Gates the Roll back action in the resource's revision
 * history.
 *
 * Independent of the component-side rollback permission, so a PE can grant
 * Resource-only authority without also granting component-binding authority.
 *
 * Must be used within an EntityProvider context.
 */
export const useResourceReleaseBindingRollbackPermission = (
  environment?: string,
): UseResourceReleaseBindingRollbackPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoResourceReleaseBindingRollbackPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to roll back the resource in ${environment}`
      : 'You do not have permission to roll back the resource';
  }

  return {
    canRollback: allowed,
    loading,
    deniedTooltip,
  };
};
