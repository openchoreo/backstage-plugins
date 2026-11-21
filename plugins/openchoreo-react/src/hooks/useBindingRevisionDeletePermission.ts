import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import {
  openchoreoReleaseBindingDeleteRevisionPermission,
  openchoreoResourceReleaseBindingDeleteRevisionPermission,
} from '@openchoreo/backstage-plugin-common';
import { useEnvScopedPermission } from './useEnvScopedPermission';

/**
 * Result of the useReleaseBindingDeleteRevisionPermission and
 * useResourceReleaseBindingDeleteRevisionPermission hooks.
 */
export interface UseBindingRevisionDeletePermissionResult {
  /** Whether the user may delete revisions from the binding's history */
  canDeleteRevision: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message to show when permission is denied (empty when allowed/loading) */
  deniedTooltip: string;
}

const useDeleteRevisionPermission = (
  permission:
    | typeof openchoreoReleaseBindingDeleteRevisionPermission
    | typeof openchoreoResourceReleaseBindingDeleteRevisionPermission,
  environment?: string,
): UseBindingRevisionDeletePermissionResult => {
  const { entity } = useEntity();
  const { allowed, loading } = useEnvScopedPermission({
    permission,
    resourceRef: stringifyEntityRef(entity),
    environment,
  });

  let deniedTooltip = '';
  if (!allowed && !loading) {
    deniedTooltip = environment
      ? `You do not have permission to delete revisions in ${environment}`
      : 'You do not have permission to delete revisions';
  }

  return { canDeleteRevision: allowed, loading, deniedTooltip };
};

/**
 * Hook for checking `releasebinding:delete-revision` on the current
 * Component entity, optionally scoped to an environment for ABAC
 * `resource.environment` CEL constraints. Gates the Delete action in the
 * Revision Browser.
 *
 * Must be used within an EntityProvider context.
 */
export const useReleaseBindingDeleteRevisionPermission = (
  environment?: string,
): UseBindingRevisionDeletePermissionResult =>
  useDeleteRevisionPermission(
    openchoreoReleaseBindingDeleteRevisionPermission,
    environment,
  );

/**
 * Hook for checking `resourcereleasebinding:delete-revision` on the current
 * Resource entity, optionally scoped to an environment. Gates the Delete
 * action in the Resource Revision Browser.
 *
 * Must be used within an EntityProvider context.
 */
export const useResourceReleaseBindingDeleteRevisionPermission = (
  environment?: string,
): UseBindingRevisionDeletePermissionResult =>
  useDeleteRevisionPermission(
    openchoreoResourceReleaseBindingDeleteRevisionPermission,
    environment,
  );
