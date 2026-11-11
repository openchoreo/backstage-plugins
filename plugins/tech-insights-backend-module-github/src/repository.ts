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
  /**
   * Decoded path segments after `/tree/` or `/blob/` in a source URL: the
   * ref, then any path inside the repository. A ref can contain `/`, so
   * where it ends is only known by asking GitHub.
   */
  urlRefPath?: string[];
}

interface RepositoryReference {
  /** Undefined for a bare `owner/repo` slug, which carries no host. */
  host?: string;
  owner: string;
  name: string;
  refPath?: string[];
}

/**
 * Parses an annotation value naming a repository: a `url:`-prefixed location
 * (as in `backstage.io/source-location`), an http(s) or ssh git URL, or an
 * `owner/repo` slug.
 */
export function parseRepositoryReference(
  value: string,
): RepositoryReference | undefined {
  const raw = value.trim().replace(/^url:/, '');

  let host: string | undefined;
  let path: string;
  const ssh =
    raw.match(/^ssh:\/\/git@([^:/]+)(?::\d+)?\/(.+)$/) ??
    raw.match(/^git@([^:/]+):(.+)$/);
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
  const [owner, repoSegment, marker, ...rest] = segments;
  const name = repoSegment.replace(/\.git$/, '');
  return {
    host,
    owner,
    name,
    refPath:
      (marker === 'tree' || marker === 'blob') && rest.length > 0
        ? rest.map(decodeSegment)
        : undefined,
  };
}

/** A URL path keeps its percent-encoding, but the API wants the branch name. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
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
      urlRefPath: reference.refPath,
    };
  }
  return undefined;
}

/**
 * The branches to try, in order: the first configured branch annotation
 * present on the entity, else each leading part of the ref path in the
 * repository URL, shortest first. Git refuses a branch whose name extends
 * another's at a `/` (`feature` and `feature/login` can't both exist), so at
 * most one of those parts is a branch. Empty means the caller should use the
 * repository's default branch.
 */
export function branchCandidates(
  entity: Entity,
  repository: GithubRepository,
  branchAnnotations: string[],
): string[] {
  for (const annotation of branchAnnotations) {
    const value = entity.metadata.annotations?.[annotation]?.trim();
    if (value) {
      return [value];
    }
  }
  const path = repository.urlRefPath ?? [];
  return path.map((_, index) => path.slice(0, index + 1).join('/'));
}
