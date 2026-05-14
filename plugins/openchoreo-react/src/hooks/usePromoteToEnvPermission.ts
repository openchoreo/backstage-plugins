import { useDeployPermission } from './useDeployPermission';
import { useReleaseBindingUpdatePermission } from './useReleaseBindingUpdatePermission';

/**
 * Result of the usePromoteToEnvPermission hook.
 */
export interface UsePromoteToEnvPermissionResult {
  /** Whether the user has permission to promote to the target environment */
  canPromote: boolean;
  /** Whether either permission check is still loading */
  loading: boolean;
  /** Tooltip explaining which half (or both) is denied; empty when allowed/loading */
  deniedTooltip: string;
}

/**
 * Composite permission hook for the per-target Promote action.
 *
 * Promoting to an environment creates a new release binding (or transitions
 * the existing one) *and* mutates lifecycle state — so it requires BOTH
 * `releasebinding:create` AND `releasebinding:update` on the **target**
 * environment. Either being denied is enough to disable the button; the
 * tooltip surfaces which half is missing.
 *
 * Must be used within an EntityProvider context. `targetEnvironment`
 * should be the Kubernetes resource name (not the display name).
 */
export const usePromoteToEnvPermission = (
  targetEnvironment: string,
): UsePromoteToEnvPermissionResult => {
  const deploy = useDeployPermission(targetEnvironment);
  const update = useReleaseBindingUpdatePermission(targetEnvironment);

  const loading = deploy.loading || update.loading;
  const canPromote = deploy.canDeploy && update.canUpdate;

  let deniedTooltip = '';
  if (!canPromote && !loading) {
    if (!deploy.canDeploy && !update.canUpdate) {
      deniedTooltip = `You do not have permission to promote to ${targetEnvironment}`;
    } else if (!deploy.canDeploy) {
      deniedTooltip = deploy.deniedTooltip;
    } else {
      deniedTooltip = update.deniedTooltip;
    }
  }

  return { canPromote, loading, deniedTooltip };
};
