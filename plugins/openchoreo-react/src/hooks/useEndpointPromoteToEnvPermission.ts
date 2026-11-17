import { useEndpointReleaseBindingCreatePermission } from './useEndpointReleaseBindingCreatePermission';
import { useEndpointReleaseBindingUpdatePermission } from './useEndpointReleaseBindingUpdatePermission';

/**
 * Result of the useEndpointPromoteToEnvPermission hook.
 */
export interface UseEndpointPromoteToEnvPermissionResult {
  /** Whether the user has permission to promote to the target environment */
  canPromote: boolean;
  /** Whether either permission check is still loading */
  loading: boolean;
  /** Tooltip explaining which half (or both) is denied; empty when allowed/loading */
  deniedTooltip: string;
}

/**
 * Composite permission hook for the per-target Promote action on an Endpoint.
 *
 * Mirrors `usePromoteToEnvPermission` for Components. Promoting to an
 * environment creates a new EndpointReleaseBinding (or advances the existing
 * one) AND mutates lifecycle state, so it requires BOTH
 * `endpointreleasebinding:create` AND `endpointreleasebinding:update` on the
 * target environment. Either being denied disables the button; the tooltip
 * surfaces which half is missing.
 *
 * Must be used within an EntityProvider context. `targetEnvironment` should
 * be the Kubernetes resource name (e.g. "production"), not the display name
 * ("Production"), so the ABAC `resource.environment` CEL check matches.
 */
export const useEndpointPromoteToEnvPermission = (
  targetEnvironment: string,
): UseEndpointPromoteToEnvPermissionResult => {
  const create = useEndpointReleaseBindingCreatePermission(targetEnvironment);
  const update = useEndpointReleaseBindingUpdatePermission(targetEnvironment);

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
