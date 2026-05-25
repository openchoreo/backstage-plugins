import { useResourceReleaseBindingCreatePermission } from './useResourceReleaseBindingCreatePermission';
import { useResourceReleaseBindingUpdatePermission } from './useResourceReleaseBindingUpdatePermission';

/**
 * Result of the useResourcePromoteToEnvPermission hook.
 */
export interface UseResourcePromoteToEnvPermissionResult {
  /** Whether the user has permission to promote to the target environment */
  canPromote: boolean;
  /** Whether either permission check is still loading */
  loading: boolean;
  /** Tooltip explaining which half (or both) is denied; empty when allowed/loading */
  deniedTooltip: string;
}

/**
 * Composite permission hook for the per-target Promote action on a Resource.
 *
 * Mirrors `usePromoteToEnvPermission` for Components. Promoting to an
 * environment creates a new ResourceReleaseBinding (or advances the existing
 * one) AND mutates lifecycle state, so it requires BOTH
 * `resourcereleasebinding:create` AND `resourcereleasebinding:update` on the
 * target environment. Either being denied disables the button; the tooltip
 * surfaces which half is missing.
 *
 * Must be used within an EntityProvider context. `targetEnvironment` should
 * be the Kubernetes resource name (e.g. "production"), not the display name
 * ("Production"), so the ABAC `resource.environment` CEL check matches.
 */
export const useResourcePromoteToEnvPermission = (
  targetEnvironment: string,
): UseResourcePromoteToEnvPermissionResult => {
  const create = useResourceReleaseBindingCreatePermission(targetEnvironment);
  const update = useResourceReleaseBindingUpdatePermission(targetEnvironment);

  const loading = create.loading || update.loading;
  const canPromote = create.canCreate && update.canUpdate;

  let deniedTooltip = '';
  if (!canPromote && !loading) {
    if (!create.canCreate && !update.canUpdate) {
      deniedTooltip = `You do not have permission to promote to ${targetEnvironment}`;
    } else if (!create.canCreate) {
      deniedTooltip = create.deniedTooltip;
    } else {
      deniedTooltip = update.deniedTooltip;
    }
  }

  return { canPromote, loading, deniedTooltip };
};
