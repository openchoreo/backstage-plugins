import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import type {
  BasicPermission,
  ResourcePermission,
} from '@backstage/plugin-permission-common';
import {
  KIND_TO_PERMISSIONS,
  FALLBACK_PERMISSION,
} from './useResourceDefinitionPermission';

/**
 * Result of the useEntityDeletePermission hook.
 */
export interface UseEntityDeletePermissionResult {
  /** Whether the user has permission to delete this entity */
  canDelete: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
  /** Tooltip message when delete is denied (empty string when allowed/loading) */
  deniedTooltip: string;
}

/**
 * Checks whether the current user may delete the given entity.
 *
 * Uses the same kind-to-permission mapping as
 * `useResourceDefinitionPermission`, but takes the entity as an argument
 * instead of reading it from entity context, so it can gate per-row actions
 * in listings. Kinds without a mapped permission are denied, matching
 * `useResourceDefinitionPermission`. Note that component and project kinds
 * have no dedicated delete permission — their update permission is checked
 * instead, with the API's own authorization as the enforcement backstop.
 */
export function useEntityDeletePermission(
  entity: Entity,
): UseEntityDeletePermissionResult {
  const permissions = KIND_TO_PERMISSIONS[entity.kind.toLowerCase()];
  const deletePerm = permissions?.delete ?? FALLBACK_PERMISSION;
  const isResourceScoped = permissions?.isResourceScoped ?? true;

  const input = isResourceScoped
    ? {
        permission: deletePerm as ResourcePermission,
        resourceRef: stringifyEntityRef(entity),
      }
    : { permission: deletePerm as BasicPermission };

  const { allowed, loading } = usePermission(input);
  const canDelete = permissions ? allowed : false;

  return {
    canDelete,
    loading,
    deniedTooltip:
      !canDelete && !loading
        ? 'You do not have permission to delete this resource'
        : '',
  };
}
