import type { Entity } from '@backstage/catalog-model';
import type { MaturityApi } from '@backstage-community/plugin-tech-insights-maturity';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { normalizeRef } from './rollup';

/** Entity fields the scorecard views and the rollup need from the catalog. */
export const ENTITY_FIELDS = [
  'kind',
  'metadata.name',
  'metadata.namespace',
  'metadata.title',
  'spec.type',
  'relations',
];

/**
 * The client's bulk call loops with `i <= entities.length` in steps of 750
 * (`runBulkChecks` in
 * https://github.com/backstage/community-plugins/blob/main/workspaces/tech-insights/plugins/tech-insights-common/src/client/TechInsightsClient.ts),
 * so a list whose length is a multiple of 750 also sends `entities: []`,
 * which the backend treats as "every entity with facts". Chunks below 750
 * never hit that.
 */
const BULK_CHUNK_SIZE = 500;

/**
 * Each entity's own check results, keyed by `normalizeRef`, through the
 * tech-insights bulk `POST /checks/run` so the fan-out happens server-side.
 */
export async function evaluateEntities(
  maturityApi: MaturityApi,
  entities: Entity[],
): Promise<Map<string, MaturityCheckResult[]>> {
  const results = new Map<string, MaturityCheckResult[]>();
  for (let i = 0; i < entities.length; i += BULK_CHUNK_SIZE) {
    const chunk = await maturityApi.getBulkMaturityCheckResults(
      entities.slice(i, i + BULK_CHUNK_SIZE),
    );
    chunk.forEach(r => results.set(normalizeRef(r.entity), r.checks));
  }
  return results;
}
