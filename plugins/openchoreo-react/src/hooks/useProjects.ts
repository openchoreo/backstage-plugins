import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export type ProjectEntry = {
  name: string;
  namespace: string;
};

export function useProjects(namespaces?: string[]) {
  const catalogApi = useApi(catalogApiRef);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const requestIdRef = useRef(0);

  const namespacesKey = useMemo(
    () => namespaces?.slice().sort().join(',') ?? '',
    [namespaces],
  );

  const fetchProjects = useCallback(async () => {
    const id = ++requestIdRef.current;
    try {
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          ...(namespaces && namespaces.length > 0
            ? { 'metadata.namespace': namespaces }
            : {}),
        },
        fields: ['metadata.name', 'metadata.namespace'],
      });
      if (id === requestIdRef.current) {
        const entries: ProjectEntry[] = response.items
          .map(e => ({
            name: e.metadata.name,
            namespace: e.metadata.namespace ?? DEFAULT_NAMESPACE,
          }))
          .sort((a, b) => {
            const nsCmp = a.namespace.localeCompare(b.namespace);
            return nsCmp !== 0 ? nsCmp : a.name.localeCompare(b.name);
          });
        setProjects(entries);
      }
    } catch {
      if (id === requestIdRef.current) {
        setProjects([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogApi, namespacesKey]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return projects;
}
