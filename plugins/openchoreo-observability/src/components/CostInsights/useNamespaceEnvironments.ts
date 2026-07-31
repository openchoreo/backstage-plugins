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
 * Lists the environments belonging to a namespace, straight from the catalog
 * (`kind: Environment`). Unlike `useProjectEnvironments` this needs no project,
 * so it works at every Cost Insights scope level — including the namespace view
 * where no project is selected yet.
 */
export const useNamespaceEnvironments = (
  namespace: string | undefined,
): UseNamespaceEnvironmentsResult => {
  const catalogApi = useApi(catalogApiRef);

  const { data, loading, isRefetching, error } = useOpenChoreoQuery<
    Environment[]
  >(
    ['cost-insights-namespace-environments', namespace ?? ''],
    async () => {
      if (!namespace) return [];
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'Environment', 'metadata.namespace': namespace },
        fields: [
          'metadata.name',
          'metadata.namespace',
          'metadata.title',
          'metadata.annotations',
        ],
      });
      return items
        .map(entry => {
          const ann = entry.metadata.annotations ?? {};
          return {
            name: entry.metadata.name,
            displayName: entry.metadata.title ?? entry.metadata.name,
            namespace: ann[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespace,
          } as Environment;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    { enabled: Boolean(namespace) },
  );

  return {
    environments: data ?? [],
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to load environments' : null,
  };
};
