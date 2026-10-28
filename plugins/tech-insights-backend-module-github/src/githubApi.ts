import {
  DefaultGithubCredentialsProvider,
  type ScmIntegrationRegistry,
} from '@backstage/integration';
import type { GithubRepository } from './repository';

/** Thrown when GitHub reports an exhausted rate limit. */
export class GithubRateLimitError extends Error {
  constructor(status: number) {
    super(`GitHub API rate limit exceeded (HTTP ${status})`);
    this.name = 'GithubRateLimitError';
  }
}

/**
 * Whether a response means a rate limit rather than a refused request.
 * GitHub answers both primary and secondary limits with 403 or 429, but only
 * sets `x-ratelimit-remaining: 0` for the primary one; a secondary limit
 * carries `retry-after` instead
 * (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
 * A 403 with neither header is a permission problem.
 */
export function isRateLimited(
  status: number,
  headers: Pick<Headers, 'get' | 'has'>,
): boolean {
  if (status === 429) return true;
  return (
    status === 403 &&
    (headers.get('x-ratelimit-remaining') === '0' || headers.has('retry-after'))
  );
}

export interface GithubApiResponse {
  status: number;
  body: any;
}

export interface GithubApi {
  /** GET `<apiBaseUrl>/repos/<owner>/<repo><path>`. */
  getRepo(
    repository: GithubRepository,
    path?: string,
  ): Promise<GithubApiResponse>;
}

/**
 * Encodes each segment of a branch name, keeping `/` separators so branches
 * such as `release/1.x` address the right path.
 */
export function encodeBranch(branch: string): string {
  return branch.split('/').map(encodeURIComponent).join('/');
}

/**
 * Credentials come from `integrations.github` through Backstage's own
 * credentials provider — a GitHub App installation for the repository owner
 * when one is configured, else the host's token — so no credential handling
 * lives in this module.
 */
export function createGithubApi(
  integrations: ScmIntegrationRegistry,
): GithubApi {
  const credentials =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);

  return {
    async getRepo(repository, path = '') {
      const { headers } = await credentials.getCredentials({
        url: repository.url,
      });
      const response = await fetch(
        `${repository.apiBaseUrl}/repos/${repository.owner}/${repository.name}${path}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...headers,
          },
        },
      );
      if (isRateLimited(response.status, response.headers)) {
        throw new GithubRateLimitError(response.status);
      }
      const body = await response.json().catch(() => undefined);
      return { status: response.status, body };
    },
  };
}
