import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoMetricsViewPermission } from '@openchoreo/backstage-plugin-common';

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
}

/**
 * Hook for checking if the current user has permission to view metrics
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canViewMetrics, loading, deniedTooltip } = useMetricsPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canViewMetrics}>View Metrics</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useMetricsPermission = (): UseMetricsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoMetricsViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading
      ? 'You do not have permission to view metrics of this component.'
      : '';

  return { canViewMetrics: allowed, loading, deniedTooltip };
};
