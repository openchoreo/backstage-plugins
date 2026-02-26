import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export function useProjects(namespace?: string) {
  const catalogApi = useApi(catalogApiRef);
  const [projects, setProjects] = useState<string[]>([]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          ...(namespace ? { 'metadata.namespace': namespace } : {}),
        },
        fields: ['metadata.name'],
      });
      const names = response.items.map(e => e.metadata.name).sort();
      setProjects(names);
    } catch {
      setProjects([]);
    }
  }, [catalogApi, namespace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return projects;
}
