import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useOpenChoreoQuery,
  type Environment,
} from '@openchoreo/backstage-plugin-react';

export interface UseNamespaceEnvironmentsResult {
  environments: Environment[];
  loading: boolean;
  isRefetching: boolean;
  error: string | null;
}

/**
 * Lists the environments belonging to one or more namespaces, straight from the
 * catalog (`kind: Environment`). Unlike `useProjectEnvironments` this needs no
 * project, so it works at every Cost Insights scope level — including the
 * namespace view where no project is selected yet. Across multiple namespaces
 * the environments are unioned and deduped by name.
 */
export const useNamespaceEnvironments = (
  namespaces: string | string[] | undefined,
): UseNamespaceEnvironmentsResult => {
  const catalogApi = useApi(catalogApiRef);

  let requested: string[];
  if (Array.isArray(namespaces)) requested = namespaces;
  else if (namespaces) requested = [namespaces];
  else requested = [];
  const list = requested.filter(Boolean).sort();

  const { data, loading, isRefetching, error } = useOpenChoreoQuery<
    Environment[]
  >(
    ['cost-insights-namespace-environments', list.join(',')],
    async () => {
      if (list.length === 0) return [];
      const results = await Promise.all(
        list.map(namespace =>
          catalogApi.getEntities({
            filter: { kind: 'Environment', 'metadata.namespace': namespace },
            fields: [
              'metadata.name',
              'metadata.namespace',
              'metadata.title',
              'metadata.annotations',
            ],
          }),
        ),
      );
      // Dedupe by name: a shared environment name across namespaces collapses to
      // one filter option (the fan-out queries each namespace with that name).
      const byName = new Map<string, Environment>();
      results.forEach(({ items }, index) => {
        const namespace = list[index];
        for (const entry of items) {
          if (byName.has(entry.metadata.name)) continue;
          const ann = entry.metadata.annotations ?? {};
          byName.set(entry.metadata.name, {
            name: entry.metadata.name,
            displayName: entry.metadata.title ?? entry.metadata.name,
            namespace: ann[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespace,
          } as Environment);
        }
      });
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    { enabled: list.length > 0 },
  );

  return {
    environments: data ?? [],
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to load environments' : null,
  };
};
