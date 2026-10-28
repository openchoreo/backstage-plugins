import { CatalogClient } from '@backstage/catalog-client';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { ScmIntegrations } from '@backstage/integration';
import { DateTime } from 'luxon';
import type {
  FactRetrieverContext,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import {
  createGithubApi,
  GithubRateLimitError,
  type GithubApi,
} from './githubApi';
import { readGithubFactsOptions, type GithubFactsOptions } from './options';
import { resolveGithubRepository, type GithubRepository } from './repository';

/**
 * Where the previous run stopped, kept between runs so a rate limit doesn't
 * keep the same entities waiting on every run.
 */
export interface CollectionCursor {
  get(): Promise<string | undefined>;
  set(entityRef: string | undefined): Promise<void>;
}

function compareRefs(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Every fact in `schema` as null, with `resolvedFact` false. */
export function unresolvedFacts(
  schema: Record<string, unknown>,
  resolvedFact: string,
): TechInsightFact['facts'] {
  return {
    ...Object.fromEntries(Object.keys(schema).map(name => [name, null])),
    [resolvedFact]: false,
  };
}

export interface GithubFactCollectorInput {
  entity: Entity;
  repository: GithubRepository;
  api: GithubApi;
  options: GithubFactsOptions;
}

/**
 * Runs `collect` for every catalog entity matching the retriever's filter
 * that resolves to a GitHub repository. An entity that names no GitHub
 * repository gets `unresolvedFacts` when given, and is left out otherwise.
 *
 * Failures are contained per entity: tech-insights stores nothing for a run
 * whose handler throws, so one unreachable repository must not discard the
 * facts of every other entity. An entity whose `collect` throws is left out
 * of the result and keeps its previous facts until they expire.
 *
 * A rate-limit error ends the run early with the facts collected so far.
 * Entities are visited in entity-ref order starting from `cursor`, and the
 * cursor is left on the entity the limit stopped at, so the next run starts
 * there and wraps around instead of starting over.
 */
export async function collectGithubFacts(
  context: FactRetrieverContext,
  collect: (
    input: GithubFactCollectorInput,
  ) => Promise<TechInsightFact['facts'] | undefined>,
  {
    unresolvedFacts: unresolved,
    cursor,
  }: {
    unresolvedFacts?: TechInsightFact['facts'];
    cursor?: CollectionCursor;
  } = {},
): Promise<TechInsightFact[]> {
  const { config, discovery, auth, logger, entityFilter } = context;
  const integrations = ScmIntegrations.fromConfig(config);
  const options = readGithubFactsOptions(config);
  const api = createGithubApi(integrations);

  const { token } = await auth.getPluginRequestToken({
    onBehalfOf: await auth.getOwnServiceCredentials(),
    targetPluginId: 'catalog',
  });
  const { items } = await new CatalogClient({
    discoveryApi: discovery,
  }).getEntities({ filter: entityFilter }, { token });

  const entities = items
    .map(entity => ({ entity, entityRef: stringifyEntityRef(entity) }))
    .sort((a, b) => compareRefs(a.entityRef, b.entityRef));
  const startRef = await cursor?.get();
  const start = startRef
    ? Math.max(
        0,
        entities.findIndex(
          ({ entityRef }) => compareRefs(entityRef, startRef) >= 0,
        ),
      )
    : 0;
  const ordered = [...entities.slice(start), ...entities.slice(0, start)];

  const results: TechInsightFact[] = [];
  let stoppedAt: string | undefined;
  for (const { entity, entityRef } of ordered) {
    try {
      const repository = resolveGithubRepository(
        entity,
        integrations,
        options.repoAnnotations,
      );
      const facts = repository
        ? await collect({ entity, repository, api, options })
        : unresolved;
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
      if (error instanceof GithubRateLimitError) {
        stoppedAt = entityRef;
        logger.warn(
          `${error.message}; stopped at ${entityRef} after ${results.length} of ${ordered.length} entities. The next run starts there.`,
        );
        break;
      }
      logger.warn(`Skipping ${entityRef}: ${(error as Error).message}`);
    }
  }
  await cursor?.set(stoppedAt);
  return results;
}
