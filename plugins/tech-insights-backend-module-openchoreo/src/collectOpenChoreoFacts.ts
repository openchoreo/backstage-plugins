import { CatalogClient } from '@backstage/catalog-client';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { DateTime } from 'luxon';
import type {
  FactRetrieverContext,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

export type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;

/**
 * Builds a client authenticated with the portal's service credentials.
 * Without credentials the client is unauthenticated, which works only
 * against a control plane with authorization turned off.
 */
export async function createServiceClient(
  context: FactRetrieverContext,
  tokenService: OpenChoreoTokenService,
): Promise<OpenChoreoApiClient> {
  const baseUrl = context.config.getString('openchoreo.baseUrl');
  const token = tokenService.hasServiceCredentials()
    ? await tokenService.getServiceToken()
    : undefined;
  return createOpenChoreoApiClient({ baseUrl, token, logger: context.logger });
}

/**
 * Every fact in `schema` as null, with `resolvedFact` false. jsonfc skips a
 * check when a fact it uses is missing, so reporting nulls is what makes a
 * check fail an entity that has no matching OpenChoreo resource.
 */
export function unresolvedFacts(
  schema: Record<string, unknown>,
  resolvedFact: string,
): TechInsightFact['facts'] {
  return {
    ...Object.fromEntries(Object.keys(schema).map(name => [name, null])),
    [resolvedFact]: false,
  };
}

/**
 * Runs `collect` for every catalog entity matching the retriever's filter.
 *
 * Failures are contained per entity: tech-insights stores nothing for a run
 * whose handler throws, so one unreadable resource must not discard the
 * facts of every other entity. An entity whose `collect` throws is left out
 * of the result and keeps its previous facts until they expire.
 */
export async function collectOpenChoreoFacts<T>(
  context: FactRetrieverContext,
  prepare: () => Promise<T>,
  collect: (
    entity: Entity,
    prepared: T,
  ) => Promise<TechInsightFact['facts'] | undefined>,
): Promise<TechInsightFact[]> {
  const { discovery, auth, logger, entityFilter } = context;

  const { token } = await auth.getPluginRequestToken({
    onBehalfOf: await auth.getOwnServiceCredentials(),
    targetPluginId: 'catalog',
  });
  const { items } = await new CatalogClient({
    discoveryApi: discovery,
  }).getEntities({ filter: entityFilter }, { token });

  const prepared = await prepare();
  const results: TechInsightFact[] = [];
  for (const entity of items) {
    try {
      const facts = await collect(entity, prepared);
      if (!facts) {
        continue;
      }
      results.push({
        entity: {
          namespace: entity.metadata.namespace ?? 'default',
          kind: entity.kind,
          name: entity.metadata.name,
        },
        facts,
        timestamp: DateTime.now(),
      });
    } catch (error) {
      logger.warn(
        `Skipping ${stringifyEntityRef(entity)}: ${(error as Error).message}`,
      );
    }
  }
  return results;
}
