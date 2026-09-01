import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface ObservabilityPlaneOption {
  /** Entity name, used as the value in the picker and the URL. */
  name: string;
  displayName: string;
  /** Base URL of the plane's Observer API; the browser calls it directly. */
  observerUrl?: string;
}

/**
 * Lists the observability planes a platform logs query can be pointed at.
 *
 * Reads them from the catalog rather than a dedicated API: the catalog already
 * carries `ObservabilityPlane` and `ClusterObservabilityPlane` entities with the
 * observer URL on them, which is why the epic's per-plane discoverability endpoint
 * was dropped (openchoreo/openchoreo#4559).
 */
export function useObservabilityPlanes() {
  const catalogApi = useApi(catalogApiRef);

  const { data, loading, error } = useOpenChoreoQuery<
    ObservabilityPlaneOption[]
  >(['observability-planes'], async () => {
    const [namespaced, clusterScoped] = await Promise.all([
      catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
      catalogApi.getEntities({ filter: { kind: 'ClusterObservabilityPlane' } }),
    ]);

    return [...namespaced.items, ...clusterScoped.items]
      .map(entity => ({
        name: entity.metadata.name,
        displayName: entity.metadata.title || entity.metadata.name,
        observerUrl:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.OBSERVER_URL],
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  return {
    planes: data ?? [],
    loading,
    error: error
      ? error.message || 'Failed to load observability planes'
      : null,
  };
}
