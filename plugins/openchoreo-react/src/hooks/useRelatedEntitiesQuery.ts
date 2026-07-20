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
 * The key is the QUESTION — this entity, this relation type, this target kind —
 * and deliberately NOT the resolved refs, even though the refs are what gets
 * fetched. The refs are derived from the entity that is already in the key, so
 * including them would conflate "what am I asking" with "what was the answer
 * last time": adding a project would look like a different query, land on a cold
 * entry, and render skeletons for precisely the transition this hook exists to
 * smooth (to say nothing of orphaning the old entry until `gcTime`).
 *
 * With a stable key, a revisit is a remount: TanStack hands back the previous
 * answer immediately (`loading` false, rows on screen) and `refetchOnMount` +
 * `staleTime: 0` refetch with the CURRENT refs behind it, so the table changes
 * contents without ever blanking. Relations cannot change without a remount here
 * — `useEntity` is fed by `useEntityFromUrl`'s `useAsync`, which is keyed on the
 * URL and never refreshes in place.
 */
export function useRelatedEntitiesQuery(
  entity: Entity,
  relationFilter: RelatedEntitiesFilter = {},
): RelatedEntitiesQueryResult {
  const catalogApi = useApi(catalogApiRef);

  const filterByTypeLower = relationFilter.type?.toLocaleLowerCase('en-US');
  const filterByKindLower = relationFilter.kind?.toLocaleLowerCase('en-US');

  // Sorted so row order is deterministic: `getEntitiesByRefs` returns items
  // positionally aligned to the refs it was given, so without this the rows
  // would follow whatever order the catalog provider happened to emit relations
  // in, and could reshuffle between refreshes.
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

  const hasRefs = targetRefs.length > 0;

  const { data, loading, error } = useOpenChoreoQuery<Entity[]>(
    [
      'related-entities',
      stringifyEntityRef(entity),
      filterByTypeLower ?? '*',
      filterByKindLower ?? '*',
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
    entities: hasRefs ? data : NO_ENTITIES,
    loading,
    error,
  };
}
