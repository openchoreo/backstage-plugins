import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

export interface ProjectContentFacets {
  /** Project-wide entity counts per kind (independent of search/type filters). */
  counts: { all: number; component: number; resource: number };
  /** Distinct, sorted `spec.type` values per kind. */
  typesByKind: { component: string[]; resource: string[] };
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
}

const EMPTY: ProjectContentFacets = {
  counts: { all: 0, component: 0, resource: 0 },
  typesByKind: { component: [], resource: [] },
  loading: false,
  isRefetching: false,
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

  const { data, loading, isRefetching } = useOpenChoreoQuery(
    ['project-content-facets', namespace, project],
    async (): Promise<Pick<ProjectContentFacets, 'counts' | 'typesByKind'>> => {
      // The query is `enabled` only when both are set; narrow for the catalog
      // filter type (`EntityFilterQuery` rejects `undefined` values).
      if (!project || !namespace) {
        return { counts: EMPTY.counts, typesByKind: EMPTY.typesByKind };
      }
      const base = { 'spec.system': project, 'metadata.namespace': namespace };
      const [componentRes, resourceRes] = await Promise.all([
        catalogApi.getEntityFacets({
          filter: { ...base, kind: 'Component' },
          facets: ['spec.type'],
        }),
        catalogApi.getEntityFacets({
          filter: { ...base, kind: 'Resource' },
          facets: ['spec.type'],
        }),
      ]);

      const component = readTypeFacet(componentRes.facets);
      const resource = readTypeFacet(resourceRes.facets);
      return {
        counts: {
          all: component.total + resource.total,
          component: component.total,
          resource: resource.total,
        },
        typesByKind: {
          component: component.types,
          resource: resource.types,
        },
      };
    },
    { enabled: !!project && !!namespace },
  );

  return {
    counts: data?.counts ?? EMPTY.counts,
    typesByKind: data?.typesByKind ?? EMPTY.typesByKind,
    loading,
    isRefetching,
  };
}
