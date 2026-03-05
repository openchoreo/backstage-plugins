import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export function useProjects(namespace?: string) {
  const catalogApi = useApi(catalogApiRef);
  const [projects, setProjects] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  const fetchProjects = useCallback(async () => {
    const id = ++requestIdRef.current;
    try {
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          ...(namespace ? { 'metadata.namespace': namespace } : {}),
        },
        fields: ['metadata.name'],
      });
      if (id === requestIdRef.current) {
        const names = response.items.map(e => e.metadata.name).sort();
        setProjects(names);
      }
    } catch {
      if (id === requestIdRef.current) {
        setProjects([]);
      }
    }
  }, [catalogApi, namespace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return projects;
}
