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
import {
  encodeBranch,
  GithubRateLimitError,
  type GithubApi,
} from './githubApi';
import { branchCandidates, type GithubRepository } from './repository';
import {
  branchProtectionFacts,
  PROTECTING_RULE_TYPES,
  type BranchRule,
} from './branchProtectionFacts';

/** Directories GitHub reads CODEOWNERS and SECURITY.md from. */
const COMMUNITY_FILE_DIRECTORIES = ['.github', '', 'docs'];

/**
 * Names of the files in those directories, on `branch` or else the default
 * branch. Undefined when a listing is refused, since a missing file then
 * can't be told apart from an unreadable one.
 */
async function listCommunityFiles(
  api: GithubApi,
  repository: GithubRepository,
  branch?: string,
): Promise<string[] | undefined> {
  const names: string[] = [];
  for (const directory of COMMUNITY_FILE_DIRECTORIES) {
    const path = directory ? `/contents/${directory}` : '/contents';
    const { status, body } = await api.getRepo(
      repository,
      branch ? `${path}?ref=${encodeURIComponent(branch)}` : path,
    );
    if (status === 404) {
      continue;
    }
    if (status === 403) {
      return undefined;
    }
    if (status !== 200) {
      throw new Error(
        `GET ${path} of ${repository.owner}/${repository.name} returned HTTP ${status}`,
      );
    }
    // A file at that path lists as an object rather than an array.
    if (!Array.isArray(body)) {
      continue;
    }
    for (const entry of body) {
      if (entry?.type === 'file') {
        names.push(String(entry.name));
      }
    }
  }
  return names;
}

function hasSecurityPolicy(files: string[]): boolean {
  return files.some(name => name.toLowerCase() === 'security.md');
}

/**
 * Whether the owner keeps a default SECURITY.md in a public `.github`
 * repository, which GitHub shows for each of its repositories that has none
 * of its own
 * (https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file).
 * Undefined when that repository can't be read, so a failure there costs
 * only this fact. A rate limit still stops the run.
 */
async function hasDefaultSecurityPolicy(
  api: GithubApi,
  repository: GithubRepository,
): Promise<boolean | undefined> {
  const defaults: GithubRepository = {
    ...repository,
    name: '.github',
    url: `https://${repository.host}/${repository.owner}/.github`,
    urlRefPath: undefined,
  };
  try {
    const { status, body } = await api.getRepo(defaults);
    if (status === 404) {
      return false;
    }
    if (status !== 200) {
      return undefined;
    }
    if (body?.private) {
      return false;
    }
    const files = await listCommunityFiles(api, defaults);
    return files && hasSecurityPolicy(files);
  } catch (error) {
    if (error instanceof GithubRateLimitError) {
      throw error;
    }
    return undefined;
  }
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
      'Whether the evaluated branch has a CODEOWNERS file in .github/, the root or docs/. Left out when those folders are unreadable.',
  },
  githubHasSecurityPolicy: {
    type: 'boolean',
    description:
      "Whether the evaluated branch has a SECURITY.md file in .github/, the root or docs/, or the owner's public .github repository has a default one. Left out when those folders are unreadable.",
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

/**
 * A repository or branch the portal can't read: missing, or refused with a
 * 403. `getRepo` throws for a rate-limited 403 before it gets here, so that
 * one still stops the run instead.
 */
function isUnreadable(status: number): boolean {
  return status === 404 || status === 403;
}

/**
 * The first of `candidates` that is a branch of the repository, with its
 * `GET .../branches/{branch}` body. Undefined when none is, or when one is
 * refused.
 */
async function findBranch(
  api: GithubApi,
  repository: GithubRepository,
  candidates: string[],
): Promise<{ name: string; body: any } | undefined> {
  for (const name of candidates) {
    const { status, body } = await api.getRepo(
      repository,
      `/branches/${encodeBranch(name)}`,
    );
    if (status === 200) {
      return { name, body };
    }
    if (status === 403) {
      return undefined;
    }
    if (status !== 404) {
      throw new Error(
        `GET branch '${name}' of ${repository.owner}/${repository.name} returned HTTP ${status}`,
      );
    }
  }
  return undefined;
}

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
          if (isUnreadable(repo.status)) {
            return UNRESOLVED_FACTS;
          }
          if (repo.status !== 200) {
            throw new Error(
              `GET repository ${slug} returned HTTP ${repo.status}`,
            );
          }

          const candidates = branchCandidates(
            entity,
            repository,
            options.branchAnnotations,
          );
          const found = await findBranch(
            api,
            repository,
            candidates.length > 0
              ? candidates
              : [String(repo.body.default_branch)],
          );
          if (!found) {
            return UNRESOLVED_FACTS;
          }
          const branch = found.name;
          const encoded = encodeBranch(branch);

          const rulesResponse = await api.getRepo(
            repository,
            `/rules/branches/${encoded}?per_page=100`,
          );
          let rules: BranchRule[] | 'unknown';
          if (rulesResponse.status === 200) {
            rules = rulesResponse.body as BranchRule[];
          } else if (rulesResponse.status === 404) {
            // The repository and branch were just read, so this endpoint
            // itself is missing: a GitHub Enterprise Server without rulesets.
            rules = [];
          } else if (rulesResponse.status === 403) {
            context.logger.debug(
              `Rulesets for ${slug}@${branch} unreadable (HTTP 403)`,
            );
            rules = 'unknown';
          } else {
            throw new Error(
              `GET rules for branch '${branch}' of ${slug} returned HTTP ${rulesResponse.status}`,
            );
          }

          let classicProtected = Boolean(found.body?.protected);
          let classic;
          if (classicProtected) {
            const protection = await api.getRepo(
              repository,
              `/branches/${encoded}/protection`,
            );
            if (protection.status === 200) {
              classic = protection.body;
            } else if (
              protection.status === 404 &&
              protection.body?.message === 'Branch not protected'
            ) {
              // GitHub marks a branch covered only by rulesets as `protected`,
              // yet it has no classic protection to read. A plain "Not Found"
              // 404 means the token lacks access and stays unknown.
              classicProtected = false;
            } else {
              context.logger.debug(
                `Branch protection details for ${slug}@${branch} unreadable (HTTP ${protection.status}); needs Administration: read`,
              );
              classic = 'unknown' as const;
            }
          }

          const files = await listCommunityFiles(api, repository, branch);
          let securityPolicy: boolean | undefined;
          if (files) {
            securityPolicy =
              hasSecurityPolicy(files) ||
              (await hasDefaultSecurityPolicy(api, repository));
          }
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
            ...(files && {
              githubHasCodeowners: files.includes('CODEOWNERS'),
            }),
            ...(securityPolicy !== undefined && {
              githubHasSecurityPolicy: securityPolicy,
            }),
            ...branchProtectionFacts({
              branch,
              classicProtected,
              classic,
              rules,
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
