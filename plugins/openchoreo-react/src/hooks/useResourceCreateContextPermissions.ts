import { useEffect, useState, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import { openchoreoResourceCreatePermission } from '@openchoreo/backstage-plugin-common';
import { useAuthzEnabled } from './useOpenChoreoFeatures';
import type { ResourceTypeContext } from './useResourceCreateContextPermission';

export interface ResourceCreateContextItem {
  /** Stable key (e.g. entityRef) for looking up the result. */
  key: string;
  resourceType: ResourceTypeContext;
}

export interface ResourceCreateContextDecision {
  allowed: boolean;
  loading: boolean;
}

export interface UseResourceCreateContextPermissionsOptions {
  items: ResourceCreateContextItem[];
  namespace?: string;
  project?: string;
}

export interface UseResourceCreateContextPermissionsResult {
  /** Per-item decision keyed by item key; mirrors the base check until evaluated. */
  decisions: Record<string, ResourceCreateContextDecision>;
}

/**
 * Batch variant of {@link useResourceCreateContextPermission} for the
 * template chooser — one request per item over a shared `{namespace, project}`.
 * Lets the chooser evaluate N tiles without a rules-of-hooks loop.
 */
export function useResourceCreateContextPermissions(
  options: UseResourceCreateContextPermissionsOptions,
): UseResourceCreateContextPermissionsResult {
  const { items, namespace, project } = options;

  const baseCheck = usePermission({
    permission: openchoreoResourceCreatePermission,
  });

  const authzEnabled = useAuthzEnabled();
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [results, setResults] = useState<
    Record<string, ResourceCreateContextDecision>
  >({});

  // Stable dep so the effect re-runs on content change, not array identity.
  const signature = useMemo(
    () =>
      JSON.stringify(
        items.map(i => [i.key, i.resourceType.name, i.resourceType.kind]),
      ),
    [items],
  );

  useEffect(() => {
    const skip =
      !authzEnabled ||
      !namespace ||
      !project ||
      items.length === 0 ||
      baseCheck.loading;
    if (skip) {
      setResults({});
      return undefined;
    }

    if (!baseCheck.allowed) {
      // Base denied — every tile is denied without a backend call.
      const denied: Record<string, ResourceCreateContextDecision> = {};
      for (const it of items) {
        denied[it.key] = { allowed: false, loading: false };
      }
      setResults(denied);
      return undefined;
    }

    let cancelled = false;
    // Mark every tile loading up front.
    const loadingMap: Record<string, ResourceCreateContextDecision> = {};
    for (const it of items) {
      loadingMap[it.key] = { allowed: false, loading: true };
    }
    setResults(loadingMap);

    const run = async () => {
      let baseUrl: string;
      try {
        baseUrl = await discovery.getBaseUrl('permission');
      } catch {
        if (!cancelled) {
          const failed: Record<string, ResourceCreateContextDecision> = {};
          for (const it of items) {
            failed[it.key] = { allowed: false, loading: false };
          }
          setResults(failed);
        }
        return;
      }

      // Parallel; the backend cache makes this ~1 upstream eval + N-1 hits.
      const settled = await Promise.allSettled(
        items.map(async it => {
          const res = await fetchApi.fetch(`${baseUrl}/evaluate-with-context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              permissionName: openchoreoResourceCreatePermission.name,
              namespace,
              project,
              resourceType: {
                name: it.resourceType.name,
                kind: it.resourceType.kind,
              },
            }),
          });
          if (!res.ok) return false;
          const body = (await res.json()) as { allowed: boolean };
          return body.allowed === true;
        }),
      );

      if (cancelled) return;

      const next: Record<string, ResourceCreateContextDecision> = {};
      settled.forEach((outcome, i) => {
        const allowed = outcome.status === 'fulfilled' ? outcome.value : false;
        next[items[i].key] = { allowed, loading: false };
      });
      setResults(next);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    discovery,
    fetchApi,
    namespace,
    project,
    signature,
    items,
    authzEnabled,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  const decisions = useMemo(() => {
    // Degrade to base check when authz off or context incomplete.
    if (!authzEnabled || !namespace || !project || items.length === 0) {
      const map: Record<string, ResourceCreateContextDecision> = {};
      for (const it of items) {
        map[it.key] = {
          allowed: baseCheck.allowed,
          loading: baseCheck.loading,
        };
      }
      return map;
    }

    // Items not yet in `results` (mid-fetch) show as loading.
    const map: Record<string, ResourceCreateContextDecision> = {};
    for (const it of items) {
      map[it.key] = results[it.key] ?? {
        allowed: false,
        loading: true,
      };
    }
    return map;
  }, [
    authzEnabled,
    namespace,
    project,
    items,
    results,
    baseCheck.allowed,
    baseCheck.loading,
  ]);

  return { decisions };
}
