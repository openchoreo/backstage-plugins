import type { CacheService } from '@backstage/backend-plugin-api';
import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { cacheCursor, collectGithubFacts } from './collectGithubFacts';
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
import type { CodeScanningOptions } from './options';
import { resolveBranch } from './repository';

export const GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID =
  'githubCodeScanningFactRetriever';

// Only the resolved flag, like githubRepositoryFactRetriever: jsonfc skips a
// check when a fact it reads is absent, but evaluates it, and so fails it,
// when the fact is present as null.
const UNRESOLVED_FACTS = { [CODE_SCANNING_RESOLVED_FACT]: false };

const CURSOR_KEY = `${GITHUB_CODE_SCANNING_FACT_RETRIEVER_ID}:cursor`;

/**
 * One retriever for every configured scanner, with facts named per scanner
 * (`githubCodeqlOpenAlertCount`, `githubTrivyOpenAlertCount`) so a check reads
 * only the scanner it names in its rule. `githubCodeScanners` lists the
 * scanners that ran, so a rule can also require one:
 * `githubCodeScanners contains trivy`.
 *
 * Scans are read on the branch the component builds from, chosen as
 * githubRepositoryFactRetriever chooses it, so both describe the same code. A
 * repository or branch the portal can't read gets only
 * `githubCodeScanningResolved: false`, as there, and so does a repository
 * whose code scanning GitHub refuses with a 403 (off, or a token without Code
 * scanning alerts: read). Its other facts are left out, so jsonfc skips the
 * checks that read them, and the component keeps a current fact of its own
 * instead of dropping out once its facts expire. A scanner that never ran on
 * a readable repository is `Scanned` false with null counts, so a check that
 * needs it fails.
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
          // The branch githubRepositoryFactRetriever evaluates, found the same
          // way, so both retrievers describe the same code.
          const resolved = await resolveBranch(
            api,
            entity,
            repository,
            options.branchAnnotations,
          );
          if (!resolved) {
            return UNRESOLVED_FACTS;
          }
          const branch = resolved.branch.name;

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
                `Code scanning for ${repository.owner}/${repository.name}@${branch} unreadable: ${error.message}; code scanning may be off, or the token needs Code scanning alerts: read`,
              );
              return UNRESOLVED_FACTS;
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
          unresolvedFacts: UNRESOLVED_FACTS,
          cursor: cacheCursor(cache, context.logger, CURSOR_KEY),
        },
      ),
  };
}
