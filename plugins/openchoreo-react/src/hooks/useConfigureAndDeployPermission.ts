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
 */
export const useConfigureAndDeployPermission =
  (): UseConfigureAndDeployPermissionResult => {
    const { canDeploy, loading: deployLoading } = useDeployPermission();
    const { canUpdateComponent, loading: componentLoading } =
      useComponentUpdatePermission();
    const { canUpdateWorkload, loading: workloadLoading } =
      useWorkloadUpdatePermission();

    const loading = deployLoading || componentLoading || workloadLoading;
    const canConfigureAndDeploy =
      canDeploy || canUpdateComponent || canUpdateWorkload;

    const deniedTooltip =
      !canConfigureAndDeploy && !loading
        ? 'You do not have permission to configure or deploy'
        : '';

    return {
      canConfigureAndDeploy,
      loading,
      deniedTooltip,
    };
  };
