import { DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

export type ProjectEntry = {
  name: string;
  namespace: string;
};

export function useProjects(namespaces?: string[]): ProjectEntry[] {
  const catalogApi = useApi(catalogApiRef);

  // Explicit empty array means "no namespaces selected" → no projects to fetch.
  // undefined means "fetch all" (no namespace filter).
  const isEmptyNamespaces = namespaces !== undefined && namespaces.length === 0;

  // Distinguish the three states in the cache key so "fetch all" (undefined),
  // "fetch none" ([]) and a specific set never collide — `undefined` and `[]`
  // would both join to '' otherwise, serving the full list where [] wants none.
  const namespacesKey =
    namespaces === undefined
      ? '__all__'
      : `ns:${[...namespaces].sort().join(',')}`;

  const { data } = useOpenChoreoQuery(
    ['projects-catalog', namespacesKey],
    async () => {
      if (isEmptyNamespaces) {
        return [] as ProjectEntry[];
      }
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          ...(namespaces && namespaces.length > 0
            ? { 'metadata.namespace': namespaces }
            : {}),
        },
        fields: ['metadata.name', 'metadata.namespace'],
      });
      const entries: ProjectEntry[] = response.items
        .map(e => ({
          name: e.metadata.name,
          namespace: e.metadata.namespace ?? DEFAULT_NAMESPACE,
        }))
        .sort((a, b) => {
          const nsCmp = a.namespace.localeCompare(b.namespace);
          return nsCmp !== 0 ? nsCmp : a.name.localeCompare(b.name);
        });
      return entries;
    },
    { enabled: !isEmptyNamespaces },
  );

  return data ?? [];
}
