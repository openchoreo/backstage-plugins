import type {
  CacheService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import {
  collectGithubFacts,
  type CollectionCursor,
} from './collectGithubFacts';
import {
  CODE_SCANNERS_FACT,
  CODE_SCANNING_RESOLVED_FACT,
  CodeScanningUnreadableError,
  codeScannersSchema,
  codeScanningFacts,
  codeScanningResolvedSchema,
  codeScanningSchema,
  hasCodeScanningAnalysis,
  listOpenCodeScanningAlerts,
} from './codeScanningFacts';
import { findBranch, isUnreadable } from './githubRepositoryFactRetriever';
import type { CodeScanningOptions } from './options';
import { branchCandidates } from './repository';

export const GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID =
  'githubCodeScanningFactRetriever';

const CURSOR_KEY = `${GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID}:cursor`;

/**
 * Keeps where a rate-limited run stopped in the plugin's cache. A cache that
 * can't be reached only means the next run starts from the first entity.
 */
function cacheCursor(
  cache: CacheService,
  logger: LoggerService,
): CollectionCursor {
  return {
    async get() {
      try {
        return await cache.get<string>(CURSOR_KEY);
      } catch (error) {
        logger.warn(
          `Couldn't read where the last run stopped, starting from the first entity: ${
            (error as Error).message
          }`,
        );
        return undefined;
      }
    },
    async set(entityRef) {
      try {
        if (entityRef) {
          await cache.set(CURSOR_KEY, entityRef, { ttl: { days: 30 } });
        } else {
          await cache.delete(CURSOR_KEY);
        }
      } catch (error) {
        logger.warn(
          `Couldn't record where this run stopped: ${(error as Error).message}`,
        );
      }
    },
  };
}

/**
 * One retriever for every configured scanner, with facts named per scanner
 * (`githubCodeqlOpenAlertCount`, `githubTrivyOpenAlertCount`) so a check reads
 * only the scanner it names in its rule. `githubCodeScanners` lists the
 * scanners that ran, so a rule can also require one:
 * `githubCodeScanners contains trivy`.
 *
 * Scans are read on the branch the component builds from, chosen as
 * githubRepositoryFactRetriever chooses it, so both describe the same code. A
 * repository or branch the portal can't read gets the unresolved facts, as
 * there, and so does a repository whose code scanning GitHub refuses with a
 * 403 (off, or a token without Code scanning alerts: read), so that
 * `githubCodeScanningResolved` is false and the component's checks fail
 * instead of the component dropping out of them once its facts expire.
 *
 * All scanners share one row of facts per entity. They also share an endpoint
 * and a token, so an error for one is treated as an error for all. Any other
 * error, such as a rate limit or a 5xx, skips the entity, which keeps its
 * previous facts, rather than a scanner that couldn't be read looking as
 * though it never ran.
 */
export function createGithubCodeScanningFactRetriever({
  cache,
  options: { schemaVersion, tools },
}: {
  cache: CacheService;
  options: CodeScanningOptions;
}): FactRetriever {
  const unresolvedFacts = {
    [CODE_SCANNING_RESOLVED_FACT]: false,
    [CODE_SCANNERS_FACT]: null,
    ...Object.fromEntries(
      tools.flatMap(tool =>
        Object.entries(codeScanningFacts(tool.id, undefined)),
      ),
    ),
  };

  return {
    id: GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID,
    // The first number is for changes to the facts here; the second is for
    // changes to the configured scanners. tech-insights uses the highest. It
    // starts at 0.1.0, like the other retrievers here.
    version: `0.${schemaVersion}.0`,
    title: 'GitHub Code Scanning',
    description:
      'Which configured scanners ran on the branch a component builds from, and the open alerts of each by severity, read from GitHub Code Scanning.',
    entityFilter: [{ kind: 'component' }],
    schema: {
      [CODE_SCANNING_RESOLVED_FACT]: codeScanningResolvedSchema,
      [CODE_SCANNERS_FACT]: codeScannersSchema(tools),
      ...Object.fromEntries(
        tools.flatMap(tool => Object.entries(codeScanningSchema(tool))),
      ),
    },
    handler: context =>
      collectGithubFacts(
        context,
        async ({ entity, repository, api, options }) => {
          const slug = `${repository.owner}/${repository.name}`;
          const repo = await api.getRepo(repository);
          if (isUnreadable(repo.status)) {
            return unresolvedFacts;
          }
          if (repo.status !== 200) {
            throw new Error(
              `GET repository ${slug} returned HTTP ${repo.status}`,
            );
          }
          const defaultBranch = repo.body?.default_branch;
          if (typeof defaultBranch !== 'string' || defaultBranch === '') {
            throw new Error(
              `GET repository ${slug} returned no default branch`,
            );
          }

          // The branch githubRepositoryFactRetriever evaluates, found the same
          // way, so both retrievers describe the same code.
          const candidates = branchCandidates(
            entity,
            repository,
            options.branchAnnotations,
          );
          const found = await findBranch(
            api,
            repository,
            candidates.length > 0 ? candidates : [defaultBranch],
          );
          if (!found) {
            return unresolvedFacts;
          }
          const branch = found.name;

          const scanners: string[] = [];
          const facts: Record<string, boolean | number | null> = {};
          try {
            for (const { id, toolName } of tools) {
              const ran = await hasCodeScanningAnalysis(
                api,
                repository,
                toolName,
                branch,
              );
              if (ran) scanners.push(id);
              const alerts = ran
                ? await listOpenCodeScanningAlerts(
                    api,
                    repository,
                    toolName,
                    branch,
                  )
                : undefined;
              Object.assign(facts, codeScanningFacts(id, alerts));
            }
          } catch (error) {
            if (error instanceof CodeScanningUnreadableError) {
              context.logger.debug(
                `Code scanning for ${slug}@${branch} unreadable: ${error.message}; code scanning may be off, or the token needs Code scanning alerts: read`,
              );
              return unresolvedFacts;
            }
            throw error;
          }
          return {
            [CODE_SCANNING_RESOLVED_FACT]: true,
            [CODE_SCANNERS_FACT]: scanners,
            ...facts,
          };
        },
        {
          unresolvedFacts,
          cursor: cacheCursor(cache, context.logger),
        },
      ),
  };
}
