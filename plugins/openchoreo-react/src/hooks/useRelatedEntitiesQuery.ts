import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

/** Relation filter, matching Backstage's `useRelatedEntities` options. */
export interface RelatedEntitiesFilter {
  type?: string;
  kind?: string;
}

export interface RelatedEntitiesQueryResult {
  entities: Entity[] | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetches the entities an entity's relations point at, optionally filtered by
 * relation type and target kind — the same contract as Backstage's
 * `useRelatedEntities`, but as a `useOpenChoreoQuery` observer.
 *
 * Why not Backstage's version: it is a one-shot `useAsync`, so it resolves once
 * and can never be told about newer data. Our `CachingCatalogApi` is honest
 * about staleness, so a revisit refetches — but with `useAsync` that means
 * skeleton rows for the whole round-trip. As an observer, the previous result
 * paints instantly from the query cache and the row set re-renders when the
 * refetch lands.
 *
 * The cache key is built from the RESOLVED target refs rather than the entity
 * object (which is what Backstage's `useAsync` dep list keys on): two renders
 * holding different `Entity` instances with identical relations should share one
 * cache entry, not refetch.
 */
export function useRelatedEntitiesQuery(
  entity: Entity,
  relationFilter: RelatedEntitiesFilter = {},
): RelatedEntitiesQueryResult {
  const catalogApi = useApi(catalogApiRef);

  const filterByTypeLower = relationFilter.type?.toLocaleLowerCase('en-US');
  const filterByKindLower = relationFilter.kind?.toLocaleLowerCase('en-US');

  const targetRefs = (entity.relations ?? [])
    .filter(
      r =>
        (!filterByTypeLower ||
          r.type.toLocaleLowerCase('en-US') === filterByTypeLower) &&
        (!filterByKindLower ||
          parseEntityRef(r.targetRef).kind === filterByKindLower),
    )
    .map(r => r.targetRef);

  // Sorted so relation ordering churn on the source entity can't fragment the
  // cache; the request itself keeps the unsorted refs (order is irrelevant to
  // getEntitiesByRefs, and callers sort their own rows).
  const refsKey = [...targetRefs].sort().join(',');
  const hasRefs = targetRefs.length > 0;

  const { data, loading, error } = useOpenChoreoQuery<Entity[]>(
    [
      'related-entities',
      stringifyEntityRef(entity),
      filterByTypeLower ?? '*',
      filterByKindLower ?? '*',
      refsKey,
    ],
    async () => {
      const { items } = await catalogApi.getEntitiesByRefs({
        entityRefs: targetRefs,
      });
      return items.filter((x): x is Entity => Boolean(x));
    },
    { enabled: hasRefs },
  );

  return {
    // No relations is a resolved empty result, not a pending one — the query is
    // disabled in that case and would otherwise leave `data` undefined forever.
    entities: hasRefs ? data : [],
    loading,
    error,
  };
}
