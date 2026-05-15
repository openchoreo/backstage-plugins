import { useDeployPermission } from './useDeployPermission';
import { useComponentUpdatePermission } from './useComponentUpdatePermission';
import { useWorkloadUpdatePermission } from './useWorkloadUpdatePermission';

/**
 * Result of the useConfigureAndDeployPermission hook.
 */
export interface UseConfigureAndDeployPermissionResult {
  /** Whether the user has at least one of the required permissions */
  canConfigureAndDeploy: boolean;
  /** Whether any permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when all permissions are denied */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to enter the
 * Configure & Deploy flow. The button is enabled if the user has at
 * least one of:
 * - releasebinding:create (deploy)
 * - component:update
 * - workload:update
 *
 * Must be used within an EntityProvider context.
 *
 * @param environment - Optional environment (kubernetes resource name) to
 *   honor ABAC `resource.environment` CEL constraints on the deploy half
 *   of the check. component:update / workload:update are component-scoped
 *   and are not env-gated.
 */
export const useConfigureAndDeployPermission = (
  environment?: string,
): UseConfigureAndDeployPermissionResult => {
  const { canDeploy, loading: deployLoading } =
    useDeployPermission(environment);
  const { canUpdateComponent, loading: componentLoading } =
    useComponentUpdatePermission();
  const { canUpdateWorkload, loading: workloadLoading } =
    useWorkloadUpdatePermission();

  const loading = deployLoading || componentLoading || workloadLoading;
  // When an environment is supplied, the deploy check is authoritative — it's
  // the only one that honors ABAC `resource.environment` constraints.
  // component/workload-update are entity-scoped and would otherwise let a
  // user enter the configure flow for an env they cannot deploy to.
  const canConfigureAndDeploy = environment
    ? canDeploy
    : canDeploy || canUpdateComponent || canUpdateWorkload;

  let deniedTooltip = '';
  if (!canConfigureAndDeploy && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to configure or deploy to ${environment}`
      : 'You do not have permission to configure or deploy';
  }

  return {
    canConfigureAndDeploy,
    loading,
    deniedTooltip,
  };
};
