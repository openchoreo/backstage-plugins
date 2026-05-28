import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
} from '@openchoreo/backstage-plugin-common';
import {
  useWorkflowScopedPermission,
  type WorkflowContext,
} from './useWorkflowScopedPermission';

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
  /** The view builds permission name identifier */
  viewPermissionName: string;
  /** The trigger build permission name identifier */
  triggerPermissionName: string;
}

/**
 * Hook for checking if the current user has permission to trigger builds
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @param workflow - Optional workflow `{ name, kind }`. When supplied, the
 *   trigger-build (`canBuild`) check also honors ABAC `resource.workflow` CEL
 *   constraints via {@link useWorkflowScopedPermission}. When omitted, the
 *   check is plain visibility-level — identical to the previous behavior, so
 *   existing call sites need no change. The view-builds (`canView`) check is
 *   never workflow-scoped.
 *
 * @example
 * ```tsx
 * // Workflow-scoped (honors resource.workflow CEL):
 * const { canBuild, triggerLoading, triggerBuildDeniedTooltip } =
 *   useBuildPermission({ name: wf.name, kind: wf.kind });
 *
 * return (
 *   <Tooltip title={triggerBuildDeniedTooltip}>
 *     <span>
 *       <Button disabled={triggerLoading || !canBuild}>Build</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useBuildPermission = (
  workflow?: WorkflowContext,
): UseBuildPermissionResult => {
  const { entity } = useEntity();
  const { allowed: canBuild, loading: triggerLoading } =
    useWorkflowScopedPermission({
      permission: openchoreoComponentBuildPermission,
      resourceRef: stringifyEntityRef(entity),
      workflow,
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
    !canView && !viewLoading
      ? 'You do not have permission to view builds of this component'
      : '';

  return {
    canBuild,
    triggerLoading,
    canView,
    viewLoading,
    triggerBuildDeniedTooltip,
    viewBuildDeniedTooltip,
    viewPermissionName: openchoreoComponentViewBuildsPermission.name,
    triggerPermissionName: openchoreoComponentBuildPermission.name,
  };
};
