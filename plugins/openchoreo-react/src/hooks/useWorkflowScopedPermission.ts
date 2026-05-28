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

/**
 * Workflow attribute sent to the backend's `/evaluate-with-context` route to
 * populate the ABAC `resource.workflow` CEL attribute.
 *
 * `name` is the workflow resource name; `kind` is its own kind string
 * (`Workflow` / `ComponentWorkflow` / `ClusterWorkflow`) which the backend
 * uses to pick cluster- vs namespace-scoped encoding.
 */
export interface WorkflowContext {
  name: string;
  kind?: string;
}

interface UseWorkflowScopedPermissionOptions {
  /** Backstage permission to evaluate (must map to an OpenChoreo action). */
  permission: Permission | ResourcePermission;
  /** Entity ref the action targets. */
  resourceRef: string;
  /**
   * Workflow to evaluate against ABAC `resource.workflow` CEL. When omitted,
   * behaves like a plain `usePermission` call.
   */
  workflow?: WorkflowContext;
}

export interface UseWorkflowScopedPermissionResult {
  allowed: boolean;
  loading: boolean;
}

/**
 * Evaluates a permission for a specific workflow, honoring ABAC CEL
 * constraints on capability entries.
 *
 * This is the workflow-attribute sibling of {@link useEnvScopedPermission} —
 * same decision flow and disabled-authz degradation.
 *
 */
export function useWorkflowScopedPermission(
  options: UseWorkflowScopedPermissionOptions,
): UseWorkflowScopedPermissionResult {
  const { permission, resourceRef, workflow } = options;

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

  const [wfAllowed, setWfAllowed] = useState<boolean | undefined>(undefined);
  const [wfLoading, setWfLoading] = useState<boolean>(false);

  // Re-run only when the meaningful workflow fields change, not on every new
  // object identity from the caller.
  const workflowName = workflow?.name;
  const workflowKind = workflow?.kind;

  useEffect(() => {
    // Don't fire the workflow fetch: authz off, no workflow, or base check still pending.
    const skip = !authzEnabled || !workflowName || baseCheck.loading;
    if (skip) {
      setWfAllowed(undefined);
      setWfLoading(false);
      return undefined;
    }

    if (!baseCheck.allowed) {
      setWfAllowed(false);
      setWfLoading(false);
      return undefined;
    }

    let cancelled = false;
    setWfLoading(true);

    const evaluate = async () => {
      try {
        const baseUrl = await discovery.getBaseUrl('permission');
        const res = await fetchApi.fetch(`${baseUrl}/evaluate-with-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permissionName: permission.name,
            resourceRef,
            workflow: { name: workflowName, kind: workflowKind },
          }),
        });
        if (cancelled) return;
        // Fail closed on network/server errors.
        const body = res.ok
          ? ((await res.json()) as { allowed: boolean })
          : null;
        setWfAllowed(body?.allowed === true);
      } catch {
        if (!cancelled) setWfAllowed(false);
      } finally {
        if (!cancelled) setWfLoading(false);
      }
    };

    evaluate();

    return () => {
      cancelled = true;
    };
  }, [
    discovery,
    fetchApi,
    permission.name,
    resourceRef,
    workflowName,
    workflowKind,
    authzEnabled,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  if (!authzEnabled || !workflowName) {
    return { allowed: baseCheck.allowed, loading: baseCheck.loading };
  }
  const workflowLoading =
    baseCheck.allowed && (wfLoading || wfAllowed === undefined);

  return {
    allowed: baseCheck.allowed && wfAllowed === true,
    loading: baseCheck.loading || workflowLoading,
  };
}
