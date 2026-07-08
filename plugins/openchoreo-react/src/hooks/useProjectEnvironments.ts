import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Environment } from '../components/EnvironmentFilter/types';

/**
 * Why the project's environment list is what it is. Lets callers show a
 * cause-specific message instead of a generic "no environments found":
 * - `ok`             — one or more environments resolved.
 * - `empty-pipeline` — the pipeline loaded but defines no environments.
 * - `forbidden`      — the caller may not view the project's deployment pipeline.
 * - `unavailable`    — the deployment pipeline could not be loaded (missing,
 *                      misconfigured, or a transient failure).
 */
export type ProjectEnvironmentsStatus =
  | 'ok'
  | 'empty-pipeline'
  | 'forbidden'
  | 'unavailable';

export interface UseProjectEnvironmentsResult {
  environments: Environment[];
  loading: boolean;
  /** Discriminates why `environments` is empty. See {@link ProjectEnvironmentsStatus}. */
  status: ProjectEnvironmentsStatus;
  /** Raw error detail for the `unavailable` case (null otherwise). */
  error: string | null;
  /** Re-run the fetch (e.g. from a Retry button). */
  refetch: () => void;
}

/**
 * Resolves the project's environments in deployment-pipeline order — source first,
 * then targets, deduped. Fans out correctly when a source has multiple targets.
 */
export const useProjectEnvironments = (
  projectName: string | undefined,
  namespaceName: string | undefined,
): UseProjectEnvironmentsResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ProjectEnvironmentsStatus>('ok');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!projectName || !namespaceName) {
      setEnvironments([]);
      setStatus('ok');
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const params = new URLSearchParams({ projectName, namespaceName });
        const res = await fetchApi.fetch(
          `${baseUrl}/deployment-pipeline?${params.toString()}`,
        );
        if (!res.ok) {
          if (cancelled) return;
          setEnvironments([]);
          if (res.status === 403) {
            setStatus('forbidden');
            setError(null);
          } else {
            setStatus('unavailable');
            setError(
              `Failed to load deployment pipeline: ${res.status} ${res.statusText}`,
            );
          }
          return;
        }
        const pipeline = await res.json();

        const orderedEnvNames: string[] = [];
        const seen = new Set<string>();
        const paths: Array<{
          sourceEnvironmentRef?: unknown;
          targetEnvironmentRefs?: Array<{ name?: string }>;
        }> = pipeline?.promotionPaths ?? [];
        for (const path of paths) {
          const sourceName =
            typeof path.sourceEnvironmentRef === 'string'
              ? path.sourceEnvironmentRef
              : (path.sourceEnvironmentRef as { name?: string } | undefined)
                  ?.name ?? '';
          if (sourceName && !seen.has(sourceName)) {
            orderedEnvNames.push(sourceName);
            seen.add(sourceName);
          }
          for (const target of path.targetEnvironmentRefs ?? []) {
            if (target?.name && !seen.has(target.name)) {
              orderedEnvNames.push(target.name);
              seen.add(target.name);
            }
          }
        }

        if (orderedEnvNames.length === 0) {
          if (!cancelled) {
            setEnvironments([]);
            setStatus('empty-pipeline');
          }
          return;
        }

        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Environment', 'metadata.namespace': namespaceName },
          fields: [
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'metadata.annotations',
          ],
        });
        if (cancelled) return;

        const byName = new Map(items.map(e => [e.metadata.name, e]));
        const resolved: Environment[] = orderedEnvNames.map(name => {
          const entry = byName.get(name);
          const ann = entry?.metadata.annotations ?? {};
          return {
            name,
            displayName: entry?.metadata.title ?? name,
            namespace: ann[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespaceName,
            dataPlaneRef: {
              name: ann['openchoreo.io/data-plane-ref'],
              kind: ann[CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND] ?? 'DataPlane',
            },
          };
        });

        if (!cancelled) {
          setEnvironments(resolved);
          setStatus('ok');
        }
      } catch (err) {
        if (!cancelled) {
          setEnvironments([]);
          setStatus('unavailable');
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load project environments',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    projectName,
    namespaceName,
    discoveryApi,
    fetchApi,
    catalogApi,
    reloadToken,
  ]);

  return { environments, loading, status, error, refetch };
};
