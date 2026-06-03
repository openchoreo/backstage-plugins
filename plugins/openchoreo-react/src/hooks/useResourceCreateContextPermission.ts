import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoResourceCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useAuthzEnabled } from './useOpenChoreoFeatures';

/**
 * resourceType for the ABAC `resource.resourceType` attribute. `kind`
 * (`ResourceType` / `ClusterResourceType`) drives cluster- vs ns-scoping.
 */
export interface ResourceTypeContext {
  name: string;
  kind?: string;
}

export interface UseResourceCreateContextPermissionOptions {
  /** All three required; otherwise the hook just returns the base check. */
  namespace?: string;
  project?: string;
  resourceType?: ResourceTypeContext;
}

export interface UseResourceCreateContextPermissionResult {
  allowed: boolean;
  loading: boolean;
}

/**
 * Evaluates `openchoreo.resource.create` for a `{namespace, project,
 * resourceType}` triple (no resourceRef — the resource doesn't exist yet).
 * Degrades to a plain {@link usePermission} when authz is off or context is
 * incomplete.
 */
export function useResourceCreateContextPermission(
  options: UseResourceCreateContextPermissionOptions,
): UseResourceCreateContextPermissionResult {
  const { namespace, project, resourceType } = options;

  const baseCheck = usePermission({
    permission: openchoreoResourceCreatePermission,
  });

  const authzEnabled = useAuthzEnabled();
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [ctxAllowed, setCtxAllowed] = useState<boolean | undefined>(undefined);
  const [ctxLoading, setCtxLoading] = useState<boolean>(false);

  const resourceTypeName = resourceType?.name;
  const resourceTypeKind = resourceType?.kind;

  useEffect(() => {
    const skip =
      !authzEnabled ||
      !namespace ||
      !project ||
      !resourceTypeName ||
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
            permissionName: openchoreoResourceCreatePermission.name,
            namespace,
            project,
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
    resourceTypeName,
    resourceTypeKind,
    authzEnabled,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  if (!authzEnabled || !namespace || !project || !resourceTypeName) {
    return { allowed: baseCheck.allowed, loading: baseCheck.loading };
  }

  const ctxStillLoading =
    baseCheck.allowed && (ctxLoading || ctxAllowed === undefined);

  return {
    allowed: baseCheck.allowed && ctxAllowed === true,
    loading: baseCheck.loading || ctxStillLoading,
  };
}
