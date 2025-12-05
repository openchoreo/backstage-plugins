import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface Component {
  uid?: string;
  name: string;
  displayName?: string;
  description?: string;
  project?: string;
  organization?: string;
}

export interface UseGetComponentsByProjectResult {
  components: Component[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch components for a specific project entity from the openchoreo backend.
 *
 * @param entity - The Backstage project entity to fetch components for
 * @returns Object containing components array, loading state, and error
 */
export const useGetComponentsByProject = (
  entity: Entity,
): UseGetComponentsByProjectResult => {
  const catalogApi = useApi(catalogApiRef);
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
  const project = entity.metadata.name;
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComponents = async () => {
      if (!organization || !project) {
        setLoading(false);
        setError(
          'Organization or project name not found in entity annotations',
        );
        setComponents([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch components from Backstage catalog API
        // Filter by kind=Component and matching organization/project annotations
        const catalogEntities = await catalogApi.getEntities({
          filter: {
            kind: 'Component',
          },
        });

        // Filter components that belong to this project and organization
        const projectComponents = catalogEntities.items
          .filter(component => {
            const compOrg =
              component.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
            const compProject =
              component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];

            return compOrg === organization && compProject === project;
          })
          .map(component => ({
            uid: component.metadata.uid,
            name: component.metadata.name,
            displayName: component.metadata.title || component.metadata.name,
            description: component.metadata.description,
            project:
              component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ||
              project,
            organization:
              component.metadata.annotations?.[
                CHOREO_ANNOTATIONS.ORGANIZATION
              ] || organization,
          }));

        setComponents(projectComponents);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch components',
        );
        setComponents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, [organization, project, catalogApi]);

  return { components, loading, error };
};
