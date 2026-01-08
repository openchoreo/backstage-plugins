import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoTraitsViewPermission } from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useTraitsPermission hook.
 */
export interface UseTraitsPermissionResult {
  /** Whether the user has permission to view traits */
  canViewTraits: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Hook for checking if the current user has permission to view traits
 * for the current entity.
 *
 * Must be used within an EntityProvider context.
 *
 * @example
 * ```tsx
 * const { canViewTraits, loading, deniedTooltip } = useTraitsPermission();
 *
 * return (
 *   <Tooltip title={deniedTooltip}>
 *     <span>
 *       <Button disabled={loading || !canViewTraits}>View Traits</Button>
 *     </span>
 *   </Tooltip>
 * );
 * ```
 */
export const useTraitsPermission = (): UseTraitsPermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = usePermission({
    permission: openchoreoTraitsViewPermission,
    resourceRef: stringifyEntityRef(entity),
  });

  const deniedTooltip =
    !allowed && !loading
      ? 'You do not have permission to view traits of this component.'
      : '';

  return { canViewTraits: allowed, loading, deniedTooltip };
};
