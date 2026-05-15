import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import type {
  Permission,
  ResourcePermission,
} from '@backstage/plugin-permission-common';

interface UseEnvScopedPermissionOptions {
  /** Backstage permission to evaluate (must map to an OpenChoreo action). */
  permission: Permission | ResourcePermission;
  /** Entity ref the action targets. */
  resourceRef: string;
  /**
   * Environment name to evaluate against ABAC `resource.environment` CEL.
   * When omitted, behaves like a plain `usePermission` call.
   */
  environment?: string;
}

interface UseEnvScopedPermissionResult {
  allowed: boolean;
  loading: boolean;
}

/**
 * Evaluates a permission for a specific environment, honoring ABAC CEL
 * constraints on capability entries.
 *
 * Decision flow:
 *   1. Run the normal `usePermission` check (Backstage permission framework
 *      → OpenChoreoPermissionPolicy → matchesCapability rule). Because the
 *      rule cannot evaluate CEL synchronously, this returns "allowed" for
 *      both unconstrained and constrained matches — i.e., visibility-level.
 *   2. When an `environment` is supplied, additionally call the policy
 *      module's `/evaluate-with-context` endpoint, which delegates to
 *      `POST /api/v1/authz/evaluates` with `context.resource.environment`
 *      whenever the matched allow entry carries CEL expressions. Result is
 *      backend-cached per `(user, action, path, environment)`.
 *
 * The combined `allowed` is the AND of both checks: visibility must pass
 * AND (no environment specified OR env-specific evaluation passed).
 */
export function useEnvScopedPermission(
  options: UseEnvScopedPermissionOptions,
): UseEnvScopedPermissionResult {
  const { permission, resourceRef, environment } = options;

  const baseCheck = usePermission(
    // `usePermission` overloads — narrow with `resourceRef` when present.
    'resourceRef' in permission ||
      (permission as ResourcePermission).resourceType
      ? { permission: permission as ResourcePermission, resourceRef }
      : ({ permission, resourceRef } as Parameters<typeof usePermission>[0]),
  );

  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [envAllowed, setEnvAllowed] = useState<boolean | undefined>(undefined);
  const [envLoading, setEnvLoading] = useState<boolean>(false);

  useEffect(() => {
    // No environment supplied → skip env-specific check. Clear envLoading
    // explicitly so a previous cancelled fetch doesn't leave it stuck true.
    if (!environment) {
      setEnvAllowed(undefined);
      setEnvLoading(false);
      return undefined;
    }
    // Visibility check still pending; wait. Once it lands as `false` we can
    // short-circuit, since env-eval can only narrow, not widen.
    if (baseCheck.loading) {
      setEnvLoading(false);
      return undefined;
    }
    if (!baseCheck.allowed) {
      setEnvAllowed(false);
      setEnvLoading(false);
      return undefined;
    }

    let cancelled = false;
    setEnvLoading(true);
    (async () => {
      try {
        const baseUrl = await discovery.getBaseUrl('permission');
        const res = await fetchApi.fetch(`${baseUrl}/evaluate-with-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permissionName: permission.name,
            resourceRef,
            environment,
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          // Fail closed on network/server errors so users don't see a button
          // light up when the backend is unhealthy.
          setEnvAllowed(false);
          return;
        }
        const body = (await res.json()) as { allowed: boolean };
        setEnvAllowed(body.allowed === true);
      } catch {
        if (!cancelled) setEnvAllowed(false);
      } finally {
        if (!cancelled) setEnvLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    discovery,
    fetchApi,
    permission.name,
    resourceRef,
    environment,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  if (!environment) {
    return { allowed: baseCheck.allowed, loading: baseCheck.loading };
  }
  const loading = baseCheck.loading || envLoading || envAllowed === undefined;
  const allowed = baseCheck.allowed && envAllowed === true;
  return { allowed, loading };
}
