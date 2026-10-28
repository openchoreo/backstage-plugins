import type {
  CacheService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { DateTime } from 'luxon';
import {
  collectGithubFacts,
  unresolvedFacts,
  type CollectionCursor,
} from './collectGithubFacts';
import { encodeBranch, type GithubApi } from './githubApi';
import { resolveBranch, type GithubRepository } from './repository';
import {
  branchProtectionFacts,
  PROTECTING_RULE_TYPES,
  type BranchRule,
} from './branchProtectionFacts';

/** Directories GitHub reads CODEOWNERS and SECURITY.md from. */
const COMMUNITY_FILE_DIRECTORIES = ['.github', '', 'docs'];

async function listCommunityFiles(
  api: GithubApi,
  repository: GithubRepository,
  branch: string,
): Promise<string[]> {
  const names: string[] = [];
  for (const directory of COMMUNITY_FILE_DIRECTORIES) {
    const path = directory ? `/contents/${directory}` : '/contents';
    const { status, body } = await api.getRepo(
      repository,
      `${path}?ref=${encodeURIComponent(branch)}`,
    );
    if (status === 404) {
      continue;
    }
    if (status !== 200 || !Array.isArray(body)) {
      throw new Error(
        `GET ${path} of ${repository.owner}/${repository.name} returned HTTP ${status}`,
      );
    }
    for (const entry of body) {
      if (entry?.type === 'file') {
        names.push(String(entry.name));
      }
    }
  }
  return names;
}

export const GITHUB_REPOSITORY_FACT_RETRIEVER_ID =
  'githubRepositoryFactRetriever';

// Field names are prefixed because jsonfc merges every retriever's facts
// into one flat namespace keyed by field name, so a bare `isArchived` would
// collide with any other retriever that defines the same field name.
const schema: FactRetriever['schema'] = {
  githubRepositoryResolved: {
    type: 'boolean',
    description:
      'Whether the component names a GitHub repository and branch the portal can read. When false, every other fact is null.',
  },
  githubIsArchived: {
    type: 'boolean',
    description: 'Whether the repository is archived',
  },
  githubVisibility: {
    type: 'string',
    description: 'Repository visibility: public, private, or internal',
  },
  githubDaysSinceLastPush: {
    type: 'integer',
    description: 'Whole days since anything was last pushed to the repository',
  },
  githubHasCodeowners: {
    type: 'boolean',
    description:
      'Whether the evaluated branch has a CODEOWNERS file in .github/, the root or docs/',
  },
  githubHasSecurityPolicy: {
    type: 'boolean',
    description:
      'Whether the evaluated branch has a SECURITY.md file in .github/, the root or docs/',
  },
  githubBranch: {
    type: 'string',
    description:
      'Branch evaluated: from a configured branch annotation, else the ref in the repository URL, else the default branch',
  },
  githubBranchProtected: {
    type: 'boolean',
    description: `Whether the branch has classic branch protection or an active ruleset rule of type ${PROTECTING_RULE_TYPES.join(
      ', ',
    )}`,
  },
  githubRequiresPullRequest: {
    type: 'boolean',
    description: 'Whether changes must go through a pull request',
  },
  githubRequiredApprovingReviewCount: {
    type: 'integer',
    description: 'Approving reviews required before merging',
  },
  githubRequiresCodeOwnerReviews: {
    type: 'boolean',
    description: 'Whether code owner review is required',
  },
  githubRequiresStatusChecks: {
    type: 'boolean',
    description: 'Whether status checks must pass before merging',
  },
  githubAllowsForcePushes: {
    type: 'boolean',
    description: 'Whether force pushes to the branch are allowed',
  },
  githubAllowsDeletions: {
    type: 'boolean',
    description: 'Whether the branch can be deleted',
  },
};

const UNRESOLVED_FACTS = unresolvedFacts(schema, 'githubRepositoryResolved');

const CURSOR_KEY = `${GITHUB_REPOSITORY_FACT_RETRIEVER_ID}:cursor`;

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

export function createGithubRepositoryFactRetriever({
  cache,
}: {
  cache: CacheService;
}): FactRetriever {
  return {
    id: GITHUB_REPOSITORY_FACT_RETRIEVER_ID,
    version: '0.1.0',
    title: 'GitHub Repository',
    description:
      'State of the GitHub repository backing a component and protection of the branch it builds from, read from the GitHub REST API.',
    entityFilter: [{ kind: 'component' }],
    schema,
    handler: context =>
      collectGithubFacts(
        context,
        async ({ entity, repository, api, options }) => {
          const slug = `${repository.owner}/${repository.name}`;
          const repo = await api.getRepo(repository);
          if (repo.status === 404) {
            return UNRESOLVED_FACTS;
          }
          if (repo.status !== 200) {
            throw new Error(
              `GET repository ${slug} returned HTTP ${repo.status}`,
            );
          }

          const branch =
            resolveBranch(entity, repository, options.branchAnnotations) ??
            String(repo.body.default_branch);
          const encoded = encodeBranch(branch);

          const branchResponse = await api.getRepo(
            repository,
            `/branches/${encoded}`,
          );
          if (branchResponse.status === 404) {
            return UNRESOLVED_FACTS;
          }
          if (branchResponse.status !== 200) {
            throw new Error(
              `GET branch '${branch}' of ${slug} returned HTTP ${branchResponse.status}`,
            );
          }
          const rulesResponse = await api.getRepo(
            repository,
            `/rules/branches/${encoded}`,
          );
          if (rulesResponse.status !== 200) {
            throw new Error(
              `GET rules for branch '${branch}' of ${slug} returned HTTP ${rulesResponse.status}`,
            );
          }

          const classicProtected = Boolean(branchResponse.body.protected);
          let classic;
          if (classicProtected) {
            const protection = await api.getRepo(
              repository,
              `/branches/${encoded}/protection`,
            );
            if (protection.status === 200) {
              classic = protection.body;
            } else {
              context.logger.debug(
                `Branch protection details for ${slug}@${branch} unreadable (HTTP ${protection.status}); needs Administration: read`,
              );
              classic = 'unknown' as const;
            }
          }

          const files = await listCommunityFiles(api, repository, branch);
          const pushedAt = repo.body.pushed_at
            ? DateTime.fromISO(String(repo.body.pushed_at))
            : undefined;

          return {
            githubRepositoryResolved: true,
            githubIsArchived: Boolean(repo.body.archived),
            githubVisibility: String(repo.body.visibility ?? 'public'),
            ...(pushedAt?.isValid && {
              githubDaysSinceLastPush: Math.max(
                0,
                Math.floor(DateTime.now().diff(pushedAt, 'days').days),
              ),
            }),
            githubHasCodeowners: files.includes('CODEOWNERS'),
            githubHasSecurityPolicy: files.some(
              name => name.toLowerCase() === 'security.md',
            ),
            ...branchProtectionFacts({
              branch,
              classicProtected,
              classic,
              rules: rulesResponse.body as BranchRule[],
            }),
          };
        },
        {
          unresolvedFacts: UNRESOLVED_FACTS,
          cursor: cacheCursor(cache, context.logger),
        },
      ),
  };
}
