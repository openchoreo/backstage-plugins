import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface Component {
  uid?: string;
  name: string;
  displayName?: string;
  description?: string;
  project?: string;
  namespace?: string;
}

export interface UseGetComponentsByProjectResult {
  components: Component[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const project = entity.metadata.name;

  // Preserve the original guard: when annotations are missing, the hook reports
  // a specific error string (not a fetch error) and skips the request.
  const guardError = !namespace || !project;

  const { data, loading, isRefetching, error } = useOpenChoreoQuery<
    Component[]
  >(
    ['project-components', namespace, project],
    async () => {
      // Fetch components from Backstage catalog API
      // Filter by kind=Component and matching namespace/project annotations
      const catalogEntities = await catalogApi.getEntities({
        filter: {
          kind: 'Component',
        },
      });

      // Filter components that belong to this project and namespace
      return catalogEntities.items
        .filter(component => {
          const compNamespace =
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
          const compProject =
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];

          return compNamespace === namespace && compProject === project;
        })
        .map(component => ({
          uid:
            component.metadata.annotations?.[
              CHOREO_ANNOTATIONS.COMPONENT_UID
            ] || component.metadata.uid,
          name: component.metadata.name,
          displayName: component.metadata.title || component.metadata.name,
          description: component.metadata.description,
          project:
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ||
            project,
          namespace:
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ||
            namespace,
        }));
    },
    { enabled: !guardError },
  );

  // Preserve the original string-error contract: the annotation guard reports a
  // specific message, otherwise surface the fetch error's message (or null).
  let errorMessage: string | null = null;
  if (guardError) {
    errorMessage = 'Namespace or project name not found in entity annotations';
  } else if (error) {
    errorMessage = error.message || 'Failed to fetch components';
  }

  return { components: data ?? [], loading, isRefetching, error: errorMessage };
};
