import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoMetricsViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useMetricsPermission hook.
 */
export interface UseMetricsPermissionResult {
  /** Whether the user has permission to view metrics */
  canViewMetrics: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view metrics
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment name. When supplied, the check
 *   also honors ABAC `resource.environment` CEL constraints (issue #3408).
 */
export const useMetricsPermission = (
  environment?: string,
): UseMetricsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoMetricsViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view metrics in ${environment}.`
      : 'You do not have permission to view metrics of this component.';
  }

  return {
    canViewMetrics: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoMetricsViewPermission.name,
  };
};
