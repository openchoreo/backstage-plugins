import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoComponentCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useAuthzEnabled } from './useOpenChoreoFeatures';

/**
 * componentType for the ABAC `resource.componentType` attribute. `kind`
 * (`ComponentType` / `ClusterComponentType`) drives cluster- vs ns-scoping.
 */
export interface ComponentTypeContext {
  name: string;
  kind?: string;
}

export interface UseComponentCreateContextPermissionOptions {
  /** All three required; otherwise the hook just returns the base check. */
  namespace?: string;
  project?: string;
  componentType?: ComponentTypeContext;
}

export interface UseComponentCreateContextPermissionResult {
  allowed: boolean;
  loading: boolean;
}

/**
 * Evaluates `openchoreo.component.create` for a `{namespace, project,
 * componentType}` triple (no resourceRef — the component doesn't exist yet).
 * Degrades to a plain {@link usePermission} when authz is off or context is
 * incomplete.
 */
export function useComponentCreateContextPermission(
  options: UseComponentCreateContextPermissionOptions,
): UseComponentCreateContextPermissionResult {
  const { namespace, project, componentType } = options;

  const baseCheck = usePermission({
    permission: openchoreoComponentCreatePermission,
  });

  const authzEnabled = useAuthzEnabled();
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [ctxAllowed, setCtxAllowed] = useState<boolean | undefined>(undefined);
  const [ctxLoading, setCtxLoading] = useState<boolean>(false);

  const componentTypeName = componentType?.name;
  const componentTypeKind = componentType?.kind;

  useEffect(() => {
    const skip =
      !authzEnabled ||
      !namespace ||
      !project ||
      !componentTypeName ||
      baseCheck.loading;
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
            permissionName: openchoreoComponentCreatePermission.name,
            namespace,
            project,
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
    namespace,
    project,
    componentTypeName,
    componentTypeKind,
    authzEnabled,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  if (!authzEnabled || !namespace || !project || !componentTypeName) {
    return { allowed: baseCheck.allowed, loading: baseCheck.loading };
  }

  const ctxStillLoading =
    baseCheck.allowed && (ctxLoading || ctxAllowed === undefined);

  return {
    allowed: baseCheck.allowed && ctxAllowed === true,
    loading: baseCheck.loading || ctxStillLoading,
  };
}
