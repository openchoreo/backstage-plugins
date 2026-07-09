import { useMemo } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { buildCreateComponentPath } from '../routing/pathBuilders';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

const CLUSTER_NAMESPACE = 'openchoreo-cluster';

export interface UseCreateComponentPathResult {
  /** The fully-built scaffolder URL with namespace filters pre-applied. */
  path: string;
  /** True while checking for cluster-level component templates. */
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
}

/**
 * Builds the navigation path to the component template selection page for a
 * given project entity.
 *
 * Pre-selects the project's namespace in the namespace filter. If cluster-level
 * component templates exist (templates in the `openchoreo-cluster` namespace
 * with spec.type === 'Component'), the cluster namespace is also pre-selected.
 * If no such templates exist, the cluster namespace is omitted from the URL so
 * the filter picker does not display it.
 */
export function useCreateComponentPath(
  entity: Entity,
): UseCreateComponentPathResult {
  const catalogApi = useApi(catalogApiRef);

  // Entity-independent: the cluster-namespace Component template facet is the
  // same for every project, so this query is keyed without the entity and is
  // shared/deduped across all callers.
  const {
    data: hasClusterTemplates,
    loading,
    isRefetching,
  } = useOpenChoreoQuery(
    ['cluster-component-templates'],
    () =>
      catalogApi
        .getEntityFacets({
          filter: {
            kind: 'Template',
            'metadata.namespace': CLUSTER_NAMESPACE,
            'spec.type': 'Component',
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
    return buildCreateComponentPath(entity.metadata.name, namespaces);
  }, [entity.metadata.name, namespace, hasClusterTemplates]);

  return { path, loading, isRefetching };
}
