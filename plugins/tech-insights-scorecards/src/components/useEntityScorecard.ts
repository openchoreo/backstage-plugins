import useAsync from 'react-use/lib/useAsync';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { getCompoundEntityRef, type Entity } from '@backstage/catalog-model';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { ENTITY_FIELDS, evaluateEntities } from '../evaluate';
import {
  childRefsOf,
  createRollup,
  normalizeRef,
  type RollupNode,
} from '../rollup';
import { progressByCategory, type CategoryProgress } from '../scoring';

export interface EntityScorecard {
  /** The entity, with the entities that belong to it nested beneath. */
  root: RollupNode;
  /** Progress per category across `root.checks`. */
  categories: CategoryProgress[];
}

/**
 * An entity's scores. For a Domain, System or Group it fetches everything
 * that belongs to it, level by level (see `ROLLUP_RELATIONS`), and
 * evaluates the whole tree in one bulk request, so the entity's tier
 * combines its own checks with those of everything beneath it.
 */
export function useEntityScorecard(entity: Entity) {
  const catalogApi = useApi(catalogApiRef);
  const maturityApi = useApi(maturityApiRef);

  return useAsyncRetry(async (): Promise<EntityScorecard> => {
    const rootRef = normalizeRef(entity);
    const entities = new Map<string, Entity>([[rootRef, entity]]);
    const requested = new Set<string>([rootRef]);
    let frontier = childRefsOf(entity);
    while (frontier.length > 0) {
      frontier.forEach(ref => requested.add(ref));
      const { items } = await catalogApi.getEntitiesByRefs({
        entityRefs: frontier,
        fields: ENTITY_FIELDS,
      });
      const next = new Set<string>();
      items.forEach(item => {
        if (!item) return;
        entities.set(normalizeRef(item), item);
        childRefsOf(item).forEach(ref => next.add(ref));
      });
      frontier = Array.from(next).filter(ref => !requested.has(ref));
    }

    const results = await evaluateEntities(
      maturityApi,
      Array.from(entities.values()),
    );
    const root = createRollup(entities, results)(rootRef)!;
    return { root, categories: progressByCategory(root.checks) };
  }, [catalogApi, maturityApi, entity]);
}

/**
 * When each fact retriever's facts were last collected for the entity,
 * keyed by retriever id. Loaded apart from the scores so that a failure, or
 * a missing permission to read facts, only leaves the times out.
 */
export function useFactCollectionTimes(
  entity: Entity,
  checks: MaturityCheckResult[] | undefined,
) {
  const api = useApi(maturityApiRef);
  const retrieverIds = Array.from(
    new Set((checks ?? []).flatMap(c => c.check.factIds)),
  ).sort();
  const key = retrieverIds.join(',');

  return useAsync(async (): Promise<Record<string, string>> => {
    if (!key) return {};
    try {
      const facts = await api.getFacts(
        getCompoundEntityRef(entity),
        key.split(','),
      );
      return Object.fromEntries(
        Object.entries(facts).map(([id, fact]) => [id, fact.timestamp]),
      );
    } catch {
      return {};
    }
  }, [api, entity, key]).value;
}
