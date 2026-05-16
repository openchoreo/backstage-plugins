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
import { useAuthzEnabled } from './useOpenChoreoFeatures';

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
 *
 * **Disabled-authz path.** When `openchoreo.features.authz.enabled = false`,
 * the policy module installs `AllowAllPolicy` and does NOT mount the
 * `/evaluate-with-context` route (see
 * `permission-backend-module-openchoreo-policy/src/module.ts`). Firing the
 * fetch anyway would 404 and fail closed to "denied" on every env tile.
 * Degrade gracefully: skip the env-eval entirely and return whatever
 * `usePermission` reports (which is `allowed: true` under AllowAllPolicy
 * for OpenChoreo resource permissions). This keeps the chokepoint in one
 * place so every consumer hook (`useDeployPermission`, …) inherits the
 * correct behavior without each repeating the guard.
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

  const authzEnabled = useAuthzEnabled();

  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [envAllowed, setEnvAllowed] = useState<boolean | undefined>(undefined);
  const [envLoading, setEnvLoading] = useState<boolean>(false);

  useEffect(() => {
    // Authz disabled → backend policy is AllowAllPolicy and the
    // /evaluate-with-context route is not mounted. Skip the fetch.
    // The final return below degrades to `baseCheck` so we propagate
    // whatever AllowAllPolicy decided.
    if (!authzEnabled) {
      setEnvAllowed(undefined);
      setEnvLoading(false);
      return undefined;
    }
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
    authzEnabled,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  if (!authzEnabled || !environment) {
    return { allowed: baseCheck.allowed, loading: baseCheck.loading };
  }
  const loading = baseCheck.loading || envLoading || envAllowed === undefined;
  const allowed = baseCheck.allowed && envAllowed === true;
  return { allowed, loading };
}
