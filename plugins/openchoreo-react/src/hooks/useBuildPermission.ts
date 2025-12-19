import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentBuildPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useBuildPermission hook.
 */
export interface UseBuildPermissionResult {
  /** Whether the user has permission to trigger builds */
  canBuild: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to trigger builds
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canBuild, loading, deniedTooltip } = useBuildPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canBuild}>Build</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useBuildPermission = (): UseBuildPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoComponentBuildPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading ? 'You do not have permission to trigger builds' : '';

  return { canBuild: allowed, loading, deniedTooltip };
};
