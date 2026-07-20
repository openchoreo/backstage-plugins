import { useMemo } from 'react';
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

/**
 * Shared empty result. Returning a fresh `[]` per render would change the
 * identity of the `data` prop the cards hand to MUI's Table on every unrelated
 * re-render, re-rendering it (and resetting page/sort state) for no reason.
 */
const NO_ENTITIES: Entity[] = [];

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
 * relation type and target kind — the same call signature as Backstage's
 * `useRelatedEntities`, but as a `useOpenChoreoQuery` observer.
 *
 * One deliberate difference from Backstage's result shape: `error` is
 * `Error | null`, not `Error | undefined`, matching every other hook in this
 * package (`UseOpenChoreoQueryResult`). Consistency inside the package beats
 * drop-in parity with the hook being replaced — but it means a migrating call
 * site that tests `error === undefined` must be updated to a truthiness check.
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
 *
 * Because the refs are IN the key, adding or removing a relation moves the query
 * to a fresh key — which, on its own, would mean an empty cache entry and a
 * skeleton for exactly the case this hook exists to smooth (a project was just
 * created). `keepPreviousData` closes that: the prior ref set's rows stay on
 * screen while the new set is fetched, so the table only ever changes contents,
 * never blanks. Callers can show a quiet spinner off `isRefetching`.
 */
export function useRelatedEntitiesQuery(
  entity: Entity,
  relationFilter: RelatedEntitiesFilter = {},
): RelatedEntitiesQueryResult {
  const catalogApi = useApi(catalogApiRef);

  const filterByTypeLower = relationFilter.type?.toLocaleLowerCase('en-US');
  const filterByKindLower = relationFilter.kind?.toLocaleLowerCase('en-US');

  // Sorted, so relation ordering churn on the source entity neither fragments
  // the cache nor reshuffles the rows. The SAME sorted array is both hashed into
  // the key and sent as the request: `getEntitiesByRefs` returns items
  // positionally aligned to the refs it was given, so a key built from a
  // different order than the request would let two callers share one entry whose
  // row order came from whichever ran first.
  const targetRefs = useMemo(
    () =>
      (entity.relations ?? [])
        .filter(
          r =>
            (!filterByTypeLower ||
              r.type.toLocaleLowerCase('en-US') === filterByTypeLower) &&
            (!filterByKindLower ||
              parseEntityRef(r.targetRef).kind === filterByKindLower),
        )
        .map(r => r.targetRef)
        .sort(),
    [entity.relations, filterByTypeLower, filterByKindLower],
  );

  const refsKey = targetRefs.join(',');
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
    { enabled: hasRefs, keepPreviousData: true },
  );

  return {
    // No relations is a resolved empty result, not a pending one — the query is
    // disabled in that case and would otherwise leave `data` undefined forever.
    entities: hasRefs ? data : NO_ENTITIES,
    loading,
    error,
  };
}
