import { useEffect, useMemo, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { buildCreateResourcePath } from '../routing/pathBuilders';

const CLUSTER_NAMESPACE = 'openchoreo-cluster';

export interface UseCreateResourcePathResult {
  /** The fully-built scaffolder URL with namespace filters pre-applied. */
  path: string;
  /** True while checking for cluster-level resource templates. */
  loading: boolean;
}

/**
 * Builds the navigation path to the resource template selection page for a
 * given project entity.
 *
 * Pre-selects the project's namespace in the namespace filter. If cluster-level
 * resource templates exist (templates in the `openchoreo-cluster` namespace
 * with spec.type === 'Resource', generated from ClusterResourceTypes), the
 * cluster namespace is also pre-selected so those resource types are visible.
 * If no such templates exist, the cluster namespace is omitted so the filter
 * picker does not display it.
 */
export function useCreateResourcePath(
  entity: Entity,
): UseCreateResourcePathResult {
  const catalogApi = useApi(catalogApiRef);
  const [hasClusterTemplates, setHasClusterTemplates] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    catalogApi
      .getEntityFacets({
        filter: {
          kind: 'Template',
          'metadata.namespace': CLUSTER_NAMESPACE,
          'spec.type': 'Resource',
        },
        facets: ['metadata.name'],
      })
      .then(({ facets }) => {
        setHasClusterTemplates((facets['metadata.name']?.length ?? 0) > 0);
      })
      .catch(() => {
        setHasClusterTemplates(false);
      });
  }, [catalogApi]);

  const namespace = entity.metadata.namespace ?? 'default';

  const path = useMemo(() => {
    // While loading, default to just the project namespace — a valid safe URL.
    if (hasClusterTemplates === null) {
      return buildCreateResourcePath(entity.metadata.name, [namespace]);
    }
    const namespaces = hasClusterTemplates
      ? [namespace, CLUSTER_NAMESPACE]
      : [namespace];
    return buildCreateResourcePath(entity.metadata.name, namespaces);
  }, [entity.metadata.name, namespace, hasClusterTemplates]);

  return { path, loading: hasClusterTemplates === null };
}
