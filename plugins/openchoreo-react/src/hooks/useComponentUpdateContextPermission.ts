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
  openchoreoComponentUpdatePermission,
} from '@openchoreo/backstage-plugin-common';
import { useAuthzEnabled } from './useOpenChoreoFeatures';

/**
 * Result of the useComponentUpdateContextPermission hook.
 *
 * Mirrors {@link UseComponentUpdatePermissionResult} so it is a drop-in
 * replacement wherever the plain update check is used.
 */
export interface UseComponentUpdateContextPermissionResult {
  /** Whether the user has permission to update this component */
  canUpdateComponent: boolean;
  /** Whether the permission check is still loading */
  loading: boolean;
}

/**
 * Evaluates `openchoreo.component.update` for the current entity, layering the
 * `resource.componentType` ABAC condition on top of the plain RBAC check. The
 * componentType is read from the entity's annotations
 * ({@link CHOREO_ANNOTATIONS.COMPONENT_TYPE} /
 * {@link CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND}).
 *
 * Degrades to a plain {@link usePermission} when authz is off or the entity has
 * no componentType annotation (i.e. it is not a component) — making it safe to
 * call unconditionally from the generic resource-definition hook.
 *
 * Must be used within an EntityProvider context.
 */
export const useComponentUpdateContextPermission =
  (): UseComponentUpdateContextPermissionResult => {
    const { entity } = useEntity();
    const resourceRef = stringifyEntityRef(entity);

    const baseCheck = usePermission({
      permission: openchoreoComponentUpdatePermission,
      resourceRef,
    });

    const authzEnabled = useAuthzEnabled();
    const discovery = useApi(discoveryApiRef);
    const fetchApi = useApi(fetchApiRef);

    const [ctxAllowed, setCtxAllowed] = useState<boolean | undefined>(
      undefined,
    );
    const [ctxLoading, setCtxLoading] = useState<boolean>(false);

    // The `component-type` annotation carries the `workloadType/name` composite
    // (e.g. `deployment/service`), but the `resource.componentType` ABAC
    // attribute is the bare ComponentType name (e.g. `service`)
    const componentTypeAnnotation =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE];
    const componentTypeName = componentTypeAnnotation
      ? componentTypeAnnotation.split('/').pop()
      : undefined;
    const componentTypeKind =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND];

    useEffect(() => {
      const skip = !authzEnabled || !componentTypeName || baseCheck.loading;
      if (skip) {
        setCtxAllowed(undefined);
        setCtxLoading(false);
        return undefined;
      }

      if (!baseCheck.allowed) {
        setCtxAllowed(false);
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
              permissionName: openchoreoComponentUpdatePermission.name,
              resourceRef,
              componentType: {
                name: componentTypeName,
                kind: componentTypeKind,
              },
            }),
          });
          if (cancelled) return;
          // Fail closed on network/server errors.
          const body = res.ok
            ? ((await res.json()) as { allowed: boolean })
            : null;
          setCtxAllowed(body?.allowed === true);
        } catch {
          if (!cancelled) setCtxAllowed(false);
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
      resourceRef,
      componentTypeName,
      componentTypeKind,
      authzEnabled,
      baseCheck.allowed,
      baseCheck.loading,
    ]);

    // Degrade to base when authz is off or this entity carries no
    // componentType annotation (not a component).
    if (!authzEnabled || !componentTypeName) {
      return {
        canUpdateComponent: baseCheck.allowed,
        loading: baseCheck.loading,
      };
    }

    const ctxStillLoading =
      baseCheck.allowed && (ctxLoading || ctxAllowed === undefined);

    return {
      canUpdateComponent: baseCheck.allowed && ctxAllowed === true,
      loading: baseCheck.loading || ctxStillLoading,
    };
  };
