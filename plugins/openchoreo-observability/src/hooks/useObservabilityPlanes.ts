import { useApi } from '@backstage/core-plugin-api';
import {
  DEFAULT_NAMESPACE,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface ObservabilityPlaneOption {
  /**
   * Full entity reference, used as the value in the picker and the URL.
   *
   * Not `metadata.name`: two kinds are listed here, so a namespaced
   * `ObservabilityPlane` and a `ClusterObservabilityPlane` can share a name, as can
   * two namespaced ones in different catalog namespaces. A bare name would then
   * resolve to whichever came back first and leave the other unreachable from both
   * the picker and a permalink.
   */
  ref: string;
  displayName: string;
  /** Entity kind, which is what makes a plane cluster-scoped or namespaced. */
  kind: string;
  /** Catalog namespace. Carried even for cluster-scoped planes, which the catalog
   * still files under one, so only `kind` says whether it is meaningful. */
  namespace: string;
  /** Base URL of the plane's Observer API; the browser calls it directly. */
  observerUrl?: string;
}

/** The kind whose planes are cluster-scoped rather than namespaced. */
export const CLUSTER_OBSERVABILITY_PLANE_KIND = 'ClusterObservabilityPlane';

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

    return (
      [...namespaced.items, ...clusterScoped.items]
        .map(entity => ({
          ref: stringifyEntityRef(entity),
          displayName: entity.metadata.title || entity.metadata.name,
          kind: entity.kind,
          namespace: entity.metadata.namespace || DEFAULT_NAMESPACE,
          observerUrl:
            entity.metadata.annotations?.[CHOREO_ANNOTATIONS.OBSERVER_URL],
        }))
        // Same-named planes are common - a cluster-scoped and a namespaced one both
        // called "default" - so ties fall back to the ref the picker labels them by,
        // which keeps the order stable rather than dependent on catalog response order.
        .sort(
          (a, b) =>
            a.displayName.localeCompare(b.displayName) ||
            a.ref.localeCompare(b.ref),
        )
    );
  });

  return {
    planes: data ?? [],
    loading,
    error: error
      ? error.message || 'Failed to load observability planes'
      : null,
  };
}
