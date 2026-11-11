import type { StatusType } from '@openchoreo/backstage-design-system';
import type { ResolvedEndpointBackend } from '@openchoreo/backstage-plugin-common';
import type { EndpointEnvironment } from '../../api/OpenChoreoClientApi';

/**
 * Maps an environment's binding state to a StatusBadge variant, so the canvas
 * tile and the detail panel always show the same badge for the same env.
 */
export function deriveEndpointEnvBadgeStatus(
  env: EndpointEnvironment,
): StatusType {
  if (!env.bindingName) return 'not-deployed';
  if (env.status === 'Ready') return 'active';
  if (env.status === 'Failed') return 'failed';
  if (env.status === 'NotReady') return 'pending';
  return 'unknown';
}

export interface EndpointReleaseDriftInfo {
  /** True if at least one direct upstream is on a different release. */
  isBehind: boolean;
  /** Direct upstreams on a different release. Empty when not behind. */
  aheadUpstreams: Array<{ envName: string; releaseName?: string }>;
}

export const NO_ENDPOINT_DRIFT: EndpointReleaseDriftInfo = {
  isBehind: false,
  aheadUpstreams: [],
};

/**
 * An environment is behind when a direct upstream (an env that promotes into
 * it) is pinned to a different release. Same rule as Resource drift.
 */
export function computeEndpointReleaseDrift(
  env: EndpointEnvironment,
  allEnvironments: EndpointEnvironment[],
): EndpointReleaseDriftInfo {
  if (!env.endpointRelease) {
    return NO_ENDPOINT_DRIFT;
  }
  const aheadUpstreams = allEnvironments
    .filter(other =>
      (other.promotionTargets ?? []).some(t => t.name === env.name),
    )
    .filter(
      u => !!u.endpointRelease && u.endpointRelease !== env.endpointRelease,
    )
    .map(u => ({ envName: u.name, releaseName: u.endpointRelease }));
  return { isBehind: aheadUpstreams.length > 0, aheadUpstreams };
}

/** The K8s name of an environment, which binding calls and ABAC key on. */
export function envResourceName(env: {
  name: string;
  resourceName?: string;
}): string {
  return env.resourceName ?? env.name;
}

/** Formats a resolved backend's in-cluster address as a URL. */
export function formatServiceURL(
  url: ResolvedEndpointBackend['serviceURL'],
): string | undefined {
  if (!url?.host) return undefined;
  const scheme = url.scheme ? `${url.scheme}://` : '';
  const port = url.port ? `:${url.port}` : '';
  return `${scheme}${url.host}${port}${url.path ?? ''}`;
}

/** Counts the backends that resolved in an environment. */
export function countResolvedBackends(env: EndpointEnvironment): {
  resolved: number;
  total: number;
} {
  const backends = env.backends ?? [];
  return {
    resolved: backends.filter(b => b.resolved).length,
    total: backends.length,
  };
}
