import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Environment } from '../components/EnvironmentFilter/types';

export interface UseProjectEnvironmentsResult {
  environments: Environment[];
  loading: boolean;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!projectName || !namespaceName) {
      setEnvironments([]);
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
          throw new Error(
            `Failed to fetch deployment pipeline: ${res.status} ${res.statusText}`,
          );
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
          if (!cancelled) setEnvironments([]);
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

        if (!cancelled) setEnvironments(resolved);
      } catch (err) {
        if (!cancelled) {
          setEnvironments([]);
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
  }, [projectName, namespaceName, discoveryApi, fetchApi, catalogApi]);

  return { environments, loading, error };
};
