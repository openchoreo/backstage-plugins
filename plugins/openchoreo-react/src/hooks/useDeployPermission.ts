import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentDeployPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useDeployPermission hook.
 */
export interface UseDeployPermissionResult {
  /** Whether the user has permission to deploy */
  canDeploy: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to deploy
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canDeploy, loading, deniedTooltip } = useDeployPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canDeploy}>Deploy</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useDeployPermission = (): UseDeployPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoComponentDeployPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading ? 'You do not have permission to deploy' : '';

  return { canDeploy: allowed, loading, deniedTooltip };
};
