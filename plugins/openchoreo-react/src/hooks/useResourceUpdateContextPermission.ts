import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import {
  CHOREO_ANNOTATIONS,
  openchoreoResourceUpdatePermission,
} from '@openchoreo/backstage-plugin-common';
import { useAuthzEnabled } from './useOpenChoreoFeatures';

/**
 * Result of the useResourceUpdateContextPermission hook.
 */
export interface UseResourceUpdateContextPermissionResult {
  /** Whether the user has permission to update this resource */
  canUpdateResource: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Evaluates `openchoreo.resource.update` for the current entity, layering the
 * `resource.resourceType` ABAC condition on top of the plain RBAC check.
 *
 * Degrades to a plain {@link usePermission} when authz is off or the entity has
 * no resourceType annotation, so it is safe to call unconditionally.
 *
 * Must be used within an EntityProvider context.
 */
export const useResourceUpdateContextPermission =
  (): UseResourceUpdateContextPermissionResult => {
    const { entity } = useEntity();
    const resourceRef = stringifyEntityRef(entity);

    const baseCheck = usePermission({
      permission: openchoreoResourceUpdatePermission,
      resourceRef,
    });

    const authzEnabled = useAuthzEnabled();
    const discovery = useApi(discoveryApiRef);
    const fetchApi = useApi(fetchApiRef);

    // Tagged with the input tuple it was evaluated for, so a stale result is
    // never reused across entities.
    const [ctxResult, setCtxResult] = useState<{
      key: string;
      allowed: boolean | undefined;
    }>({ key: '', allowed: undefined });
    const [ctxLoading, setCtxLoading] = useState<boolean>(false);

    // The `resource-type` annotation is the bare ResourceType name, used as-is.
    const resourceTypeName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RESOURCE_TYPE];
    const resourceTypeKind =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RESOURCE_TYPE_KIND];

    const ctxKey = `${resourceRef}|${resourceTypeName ?? ''}|${
      resourceTypeKind ?? ''
    }`;

    useEffect(() => {
      const skip = !authzEnabled || !resourceTypeName || baseCheck.loading;
      if (skip) {
        setCtxResult({ key: ctxKey, allowed: undefined });
        setCtxLoading(false);
        return undefined;
      }

      if (!baseCheck.allowed) {
        setCtxResult({ key: ctxKey, allowed: false });
        setCtxLoading(false);
        return undefined;
      }

      let cancelled = false;
      setCtxLoading(true);

      const evaluate = async () => {
        try {
          const baseUrl = await discovery.getBaseUrl('permission');
          const res = await fetchApi.fetch(`${baseUrl}/evaluate-with-context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              permissionName: openchoreoResourceUpdatePermission.name,
              resourceRef,
              resourceType: {
                name: resourceTypeName,
                kind: resourceTypeKind,
              },
            }),
          });
          if (cancelled) return;
          // Fail closed on network/server errors.
          const body = res.ok
            ? ((await res.json()) as { allowed: boolean })
            : null;
          setCtxResult({ key: ctxKey, allowed: body?.allowed === true });
        } catch {
          if (!cancelled) setCtxResult({ key: ctxKey, allowed: false });
        } finally {
          if (!cancelled) setCtxLoading(false);
        }
      };

      evaluate();

      return () => {
        cancelled = true;
      };
    }, [
      discovery,
      fetchApi,
      ctxKey,
      resourceRef,
      resourceTypeName,
      resourceTypeKind,
      authzEnabled,
      baseCheck.allowed,
      baseCheck.loading,
    ]);

    if (!authzEnabled || !resourceTypeName) {
      return {
        canUpdateResource: baseCheck.allowed,
        loading: baseCheck.loading,
      };
    }

    // A result for a different tuple reads as "not yet known", never an allow.
    const ctxAllowed = ctxResult.key === ctxKey ? ctxResult.allowed : undefined;

    const ctxStillLoading =
      baseCheck.allowed && (ctxLoading || ctxAllowed === undefined);

    return {
      canUpdateResource: baseCheck.allowed && ctxAllowed === true,
      loading: baseCheck.loading || ctxStillLoading,
    };
  };
