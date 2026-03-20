import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoIncidentsViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useIncidentsPermission hook.
 */
export interface UseIncidentsPermissionResult {
  /** Whether the user has permission to view incidents */
  canViewIncidents: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
  /** The permission name identifier */
  permissionName: string;
}

/**
 * Hook for checking if the current user has permission to view incidents
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canViewIncidents, loading, deniedTooltip } = useIncidentsPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canViewIncidents}>View Incidents</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useIncidentsPermission = (): UseIncidentsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoIncidentsViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const scope = entity.kind === 'System' ? 'project' : 'component';
  const deniedTooltip =
    !allowed && !loading
      ? `You do not have permission to view incidents of this ${scope}.`
      : '';

  return {
    canViewIncidents: allowed,
    loading,
    deniedTooltip,
    permissionName: openchoreoIncidentsViewPermission.name,
  };
};
