import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoWirelogsViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

export interface UseWirelogsPermissionResult {
  canViewWirelogs: boolean;
  loading: boolean;
  deniedTooltip: string;
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view wirelogs
 * for the current entity. Mirrors useLogsPermission — environment-scoped
 * when an environment is supplied (ABAC `resource.environment` CEL).
 */
export const useWirelogsPermission = (
  environment?: string,
): UseWirelogsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoWirelogsViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view wirelogs in ${environment}.`
      : `You do not have permission to view wirelogs of this ${scope}.`;
  }

  return {
    canViewWirelogs: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoWirelogsViewPermission.name,
  };
};
