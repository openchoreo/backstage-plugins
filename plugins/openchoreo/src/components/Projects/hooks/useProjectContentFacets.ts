import { useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface ProjectContentFacets {
  /** Project-wide entity counts per kind (independent of search/type filters). */
  counts: { all: number; component: number; resource: number };
  /** Distinct, sorted `spec.type` values per kind. */
  typesByKind: { component: string[]; resource: string[] };
  loading: boolean;
}

const EMPTY: ProjectContentFacets = {
  counts: { all: 0, component: 0, resource: 0 },
  typesByKind: { component: [], resource: [] },
  loading: false,
};

function readTypeFacet(
  facets: Record<string, Array<{ value: string; count: number }>>,
): { types: string[]; total: number } {
  const entries = facets['spec.type'] ?? [];
  return {
    types: entries
      .map(e => e.value)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    total: entries.reduce((sum, e) => sum + e.count, 0),
  };
}

/**
 * Derives the Kind-chip counts and the Type-filter option lists for a project
 * with two `getEntityFacets` calls (one per kind), faceted on `spec.type`. The
 * counts are project-wide totals, so the chips stay stable as the user filters.
 */
export function useProjectContentFacets(
  systemEntity: Entity,
): ProjectContentFacets {
  const catalogApi = useApi(catalogApiRef);
  const project = systemEntity.metadata.name;
  const namespace =
    systemEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const [facets, setFacets] = useState<ProjectContentFacets>({
    ...EMPTY,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (!project || !namespace) {
      setFacets(EMPTY);
      return undefined;
    }

    const base = { 'spec.system': project, 'metadata.namespace': namespace };
    Promise.all([
      catalogApi.getEntityFacets({
        filter: { ...base, kind: 'Component' },
        facets: ['spec.type'],
      }),
      catalogApi.getEntityFacets({
        filter: { ...base, kind: 'Resource' },
        facets: ['spec.type'],
      }),
    ])
      .then(([componentRes, resourceRes]) => {
        if (cancelled) return;
        const component = readTypeFacet(componentRes.facets);
        const resource = readTypeFacet(resourceRes.facets);
        setFacets({
          counts: {
            all: component.total + resource.total,
            component: component.total,
            resource: resource.total,
          },
          typesByKind: {
            component: component.types,
            resource: resource.types,
          },
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setFacets(EMPTY);
      });

    return () => {
      cancelled = true;
    };
  }, [project, namespace, catalogApi]);

  return facets;
}
