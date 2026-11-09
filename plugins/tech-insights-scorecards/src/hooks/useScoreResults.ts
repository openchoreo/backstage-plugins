import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import { ENTITY_FIELDS, evaluateEntities } from '../utils/evaluate';
import { kindsFromChecks } from '../utils/kinds';
import {
  compareNodes,
  createRollup,
  normalizeRef,
  ROLLUP_RELATIONS,
  type RollupNode,
} from '../utils/rollup';

/**
 * Fetched even when no check applies to them, so that a parent's tier is
 * combined through them the same way as on its tab, for example a Group
 * that owns a Domain.
 */
const ROLLUP_KINDS = Object.keys(ROLLUP_RELATIONS);

export interface CatalogScores {
  /** The scored kinds, as the catalog spells them. */
  kinds: string[];
  /** Every entity of those kinds, each combining what belongs to it. */
  entities: RollupNode[];
}

/**
 * Scores for the catalog. Without `kinds`, it scores every kind a published
 * check's filter names, or every kind in the catalog when a check has no
 * kind filter. Those kinds are evaluated even when `kinds` leaves them out,
 * so a listed System combines its Components the same way as on its tab.
 * Entities are evaluated through the tech-insights bulk `POST /checks/run`.
 * `refreshKey` re-runs the evaluation after checks or facts change; nothing
 * is evaluated until `enabled` is true.
 */
export function useScoreResults(
  kinds: string[] | undefined,
  refreshKey: number,
  enabled: boolean,
) {
  const catalogApi = useApi(catalogApiRef);
  const maturityApi = useApi(maturityApiRef);
  const kindsKey = kinds?.join(',') ?? '';

  return useAsync(async (): Promise<CatalogScores | undefined> => {
    if (!enabled) return undefined;

    const [checks, { facets }] = await Promise.all([
      maturityApi.getAllChecks(),
      catalogApi.getEntityFacets({ facets: ['kind'] }),
    ]);
    const wanted = kindsFromChecks(checks);
    const checkedKinds = (facets.kind ?? [])
      .map(facet => facet.value)
      .filter(
        kind =>
          wanted === 'all' || wanted.includes(kind.toLocaleLowerCase('en-US')),
      )
      .sort();
    const scoredKinds = kindsKey ? kindsKey.split(',') : checkedKinds;
    if (scoredKinds.length === 0) {
      return { kinds: [], entities: [] };
    }

    const scored = new Set(scoredKinds.map(k => k.toLocaleLowerCase('en-US')));
    const { items } = await catalogApi.getEntities({
      filter: {
        kind: Array.from(
          new Set([...scoredKinds, ...checkedKinds, ...ROLLUP_KINDS]),
        ),
      },
      fields: ENTITY_FIELDS,
    });
    const entities = new Map<string, Entity>(
      items.map(entity => [normalizeRef(entity), entity]),
    );
    const results = await evaluateEntities(maturityApi, items);
    const rollup = createRollup(entities, results);

    const isScoredKind = (entity: Entity) =>
      scored.has(entity.kind.toLocaleLowerCase('en-US'));
    const scoredNodes = items
      .filter(isScoredKind)
      .map(entity => rollup(normalizeRef(entity))!)
      .sort(compareNodes);

    return {
      kinds: Array.from(new Set(scoredNodes.map(n => n.entity.kind))).sort(),
      entities: scoredNodes,
    };
  }, [catalogApi, maturityApi, kindsKey, refreshKey, enabled]);
}
