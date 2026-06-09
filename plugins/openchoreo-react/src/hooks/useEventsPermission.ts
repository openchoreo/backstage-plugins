import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { openchoreoEventsViewPermission } from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

export interface UseEventsPermissionResult {
  canViewEvents: boolean;
  loading: boolean;
  deniedTooltip: string;
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view Kubernetes
 * events for the current entity. Mirrors useLogsPermission —
 * environment-scoped when an environment is supplied (ABAC
 * `resource.environment` CEL).
 */
export const useEventsPermission = (
  environment?: string,
): UseEventsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission: openchoreoEventsViewPermission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to view events in ${environment}.`
      : `You do not have permission to view events of this ${scope}.`;
  }

  return {
    canViewEvents: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoEventsViewPermission.name,
  };
};
