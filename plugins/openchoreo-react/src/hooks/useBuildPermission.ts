import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useBuildPermission hook.
 */
export interface UseBuildPermissionResult {
  /** Whether the user has permission to trigger builds */
  canBuild: boolean;
  /** Whether a user has permission to view builds */
  canView: boolean;
  /** Whether the trigger build permission check is still loading */
  triggerLoading: boolean;
  /** Whether the view build permission check is still loading */
  viewLoading: boolean;
  /** Tooltip message to show when trigger build permission is denied (empty string when allowed/loading) */
  triggerBuildDeniedTooltip: string;
  /** Tooltip message to show when trigger build permission is denied (empty string when allowed/loading) */
  viewBuildDeniedTooltip: string;
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
  const { allowed: canBuild, loading: triggerLoading } = usePermission({
    permission: openchoreoComponentBuildPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const { allowed: canView, loading: viewLoading } = usePermission({
    permission: openchoreoComponentViewBuildsPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const triggerBuildDeniedTooltip =
    !canBuild && !triggerLoading
      ? 'You do not have permission to trigger builds'
      : '';

  const viewBuildDeniedTooltip =
    !canView && !viewLoading ? 'You do not have permission to view builds' : '';

  return {
    canBuild,
    triggerLoading,
    canView,
    viewLoading,
    triggerBuildDeniedTooltip,
    viewBuildDeniedTooltip,
  };
};
