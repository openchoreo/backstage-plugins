import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoReleaseBindingViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useReleaseBindingViewPermission hook.
 */
export interface UseReleaseBindingViewPermissionResult {
  /** Whether the user has permission to view the release binding */
  canViewBinding: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking `releasebinding:view` on the current entity, optionally
 * scoped to a specific environment for ABAC `resource.environment` CEL
 * constraints.
 *
 * Used to hide the body of individual environment cards / detail panels
 * when the user is allowed to see *some* envs (org-level view passes) but
 * has been ABAC-denied on this particular env.
 *
 * Note: This is a resource-scoped sibling of the org-level
 * `useReleaseBindingPermission`. The latter still gates the entire
 * Environments page wrapper; this one drives per-env body swap.
 *
 * Must be used within an EntityProvider context.
 */
export const useReleaseBindingViewPermission = (
  environment?: string,
): UseReleaseBindingViewPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view the deployment in ${environment}`
      : 'You do not have permission to view the deployment';
  }

  return {
    canViewBinding: allowed,
    loading,
    deniedTooltip,
  };
};
