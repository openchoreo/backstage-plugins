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
 * sets `x-ratelimit-remaining: 0` for the primary one. A secondary limit may
 * carry `retry-after`, or neither header and only a message naming the
 * secondary rate limit
 * (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
 * A 403 with none of these is a permission problem.
 */
export function isRateLimited(
  status: number,
  headers: Pick<Headers, 'get' | 'has'>,
  body?: any,
): boolean {
  if (status === 429) return true;
  return (
    status === 403 &&
    (headers.get('x-ratelimit-remaining') === '0' ||
      headers.has('retry-after') ||
      /secondary rate limit/i.test(String(body?.message ?? '')))
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

/** How long one GitHub request may take, reading the body included. */
export const REQUEST_TIMEOUT_MS = 30_000;

const KEPT_STATUSES = new Set([200, 403, 404]);

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
 *
 * Responses are kept for the life of the returned api, so components that
 * share a repository cost one set of requests. Create one per run. Only
 * answers that hold for a whole run (200, 403 and 404) are kept. Any other
 * status or a failed request is tried again by the next caller.
 */
export function createGithubApi(
  integrations: ScmIntegrationRegistry,
  { timeoutMs = REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {},
): GithubApi {
  const credentials =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);
  const responses = new Map<string, Promise<GithubApiResponse>>();

  async function get(
    repository: GithubRepository,
    url: string,
  ): Promise<GithubApiResponse> {
    const { headers } = await credentials.getCredentials({
      url: repository.url,
    });
    const signal = AbortSignal.timeout(timeoutMs);
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...headers,
      },
      signal,
    });
    const body = await response.json().catch(error => {
      if (signal.aborted) {
        throw error;
      }
      return undefined;
    });
    if (isRateLimited(response.status, response.headers, body)) {
      throw new GithubRateLimitError(response.status);
    }
    return { status: response.status, body };
  }

  return {
    getRepo(repository, path = '') {
      const url = `${repository.apiBaseUrl}/repos/${repository.owner}/${repository.name}${path}`;
      let response = responses.get(url);
      if (!response) {
        response = get(repository, url);
        responses.set(url, response);
        response.then(
          ({ status }) => {
            if (!KEPT_STATUSES.has(status)) {
              responses.delete(url);
            }
          },
          () => responses.delete(url),
        );
      }
      return response;
    },
  };
}
