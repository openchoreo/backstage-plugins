import type { Entity } from '@backstage/catalog-model';
import type { ScmIntegrationRegistry } from '@backstage/integration';

const DEFAULT_GITHUB_HOST = 'github.com';

/** A GitHub repository resolved from an entity's annotations. */
export interface GithubRepository {
  host: string;
  owner: string;
  name: string;
  /** Web URL of the repository; selects credentials for its owner. */
  url: string;
  apiBaseUrl: string;
  /** Ref embedded in a source URL as `/tree/<ref>` or `/blob/<ref>`. */
  urlRef?: string;
}

interface RepositoryReference {
  /** Undefined for a bare `owner/repo` slug, which carries no host. */
  host?: string;
  owner: string;
  name: string;
  ref?: string;
}

/**
 * Parses an annotation value naming a repository: a `url:`-prefixed location
 * (as in `backstage.io/source-location`), an http(s) or ssh git URL, or an
 * `owner/repo` slug. Only the first path segment after `tree`/`blob` is
 * taken as the ref — a ref containing `/` cannot be told apart from the
 * path that follows it, so such branches need a branch annotation.
 */
export function parseRepositoryReference(
  value: string,
): RepositoryReference | undefined {
  const raw = value.trim().replace(/^url:/, '');

  let host: string | undefined;
  let path: string;
  const ssh = raw.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/);
  if (ssh) {
    host = ssh[1];
    path = ssh[2];
  } else if (/^https?:\/\//.test(raw)) {
    try {
      const url = new URL(raw);
      host = url.host;
      path = url.pathname;
    } catch {
      return undefined;
    }
  } else if (/^[^/\s:]+\/[^/\s:]+$/.test(raw)) {
    path = raw;
  } else {
    return undefined;
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }
  const [owner, repoSegment, marker, ref] = segments;
  const name = repoSegment.replace(/\.git$/, '');
  return {
    host,
    owner,
    name,
    ref: (marker === 'tree' || marker === 'blob') && ref ? ref : undefined,
  };
}

/**
 * Resolves the GitHub repository for an entity from the first annotation in
 * `annotations` that names a repository on a configured GitHub host.
 * Annotations pointing at other hosts (GitLab, Bitbucket, …) are passed over,
 * since the VCS is decided by matching the host against `integrations`.
 *
 * @throws when a matching GitHub host has no API base URL configured.
 */
export function resolveGithubRepository(
  entity: Entity,
  integrations: ScmIntegrationRegistry,
  annotations: string[],
): GithubRepository | undefined {
  for (const annotation of annotations) {
    const value = entity.metadata.annotations?.[annotation];
    const reference = value ? parseRepositoryReference(value) : undefined;
    if (!reference) {
      continue;
    }
    const host = reference.host ?? DEFAULT_GITHUB_HOST;
    const integration = integrations.github.byHost(host);
    if (!integration) {
      continue;
    }
    const { apiBaseUrl } = integration.config;
    if (!apiBaseUrl) {
      throw new Error(
        `GitHub host '${host}' has no integrations.github apiBaseUrl configured`,
      );
    }
    return {
      host,
      owner: reference.owner,
      name: reference.name,
      url: `https://${host}/${reference.owner}/${reference.name}`,
      apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
      urlRef: reference.ref,
    };
  }
  return undefined;
}

/**
 * The branch to evaluate: the first configured branch annotation present on
 * the entity, else a ref embedded in the repository URL. Undefined means the
 * caller should use the repository's default branch.
 */
export function resolveBranch(
  entity: Entity,
  repository: GithubRepository,
  branchAnnotations: string[],
): string | undefined {
  for (const annotation of branchAnnotations) {
    const value = entity.metadata.annotations?.[annotation]?.trim();
    if (value) {
      return value;
    }
  }
  return repository.urlRef;
}
