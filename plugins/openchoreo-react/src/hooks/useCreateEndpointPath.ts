import { useMemo } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { buildCreateEndpointPath } from '../routing/pathBuilders';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

const CLUSTER_NAMESPACE = 'openchoreo-cluster';

export interface UseCreateEndpointPathResult {
  /** The fully-built scaffolder URL with namespace filters pre-applied. */
  path: string;
  /** True while checking for cluster-level endpoint templates. */
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
}

/**
 * Builds the navigation path to the endpoint template selection page for a
 * given project entity.
 *
 * Pre-selects the project's namespace in the namespace filter. If cluster-level
 * endpoint templates exist (templates in the `openchoreo-cluster` namespace
 * with spec.type === 'Endpoint', generated from ClusterEndpointTypes), the
 * cluster namespace is also pre-selected so those endpoint types are visible.
 */
export function useCreateEndpointPath(
  entity: Entity,
): UseCreateEndpointPathResult {
  const catalogApi = useApi(catalogApiRef);

  // Entity-independent: the cluster-namespace Endpoint template facet is the
  // same for every project, so this query is keyed without the entity and is
  // shared/deduped across all callers.
  const {
    data: hasClusterTemplates,
    loading,
    isRefetching,
  } = useOpenChoreoQuery(
    ['cluster-endpoint-templates'],
    () =>
      catalogApi
        .getEntityFacets({
          filter: {
            kind: 'Template',
            'metadata.namespace': CLUSTER_NAMESPACE,
            'spec.type': 'Endpoint',
          },
          facets: ['metadata.name'],
        })
        .then(({ facets }) => (facets['metadata.name']?.length ?? 0) > 0),
    { staleTime: 5 * 60_000 },
  );

  const namespace = entity.metadata.namespace ?? 'default';

  const path = useMemo(() => {
    // Only strictly-true adds the cluster namespace. While loading (undefined)
    // or on error (data undefined) or when no templates exist, fall back to the
    // project namespace only — a valid safe URL.
    const namespaces =
      hasClusterTemplates === true
        ? [namespace, CLUSTER_NAMESPACE]
        : [namespace];
    return buildCreateEndpointPath(entity.metadata.name, namespaces);
  }, [entity.metadata.name, namespace, hasClusterTemplates]);

  return { path, loading, isRefetching };
}
