import type {
  EndpointInfo,
  EndpointURLDetails,
} from '../hooks/useEnvironmentData';
import type { ResourceTreeData } from '../ReleaseDataRenderer/types';

/** Build a full URL from EndpointURLDetails, including path. */
export function buildUrl(details: EndpointURLDetails): string {
  const portPart = details.port ? `:${details.port}` : '';
  const pathPart = details.path || '';
  return `${details.scheme}://${details.host}${portPart}${pathPart}`;
}

/**
 * Build a service URL from EndpointURLDetails. Service URLs are the
 * cluster-internal addresses (no path component).
 */
export function buildServiceUrl(details: EndpointURLDetails): string {
  const portPart = details.port ? `:${details.port}` : '';
  return `${details.scheme}://${details.host}${portPart}`;
}

export interface PrimaryEndpointUrl {
  label: 'External' | 'Internal' | 'Project';
  url: string;
}

/**
 * Pick a single representative URL across all endpoints. Falls back
 * external → internal → service (project) → null. Used by the
 * Endpoints section in the env detail panel for an at-a-glance preview;
 * the full list lives in InvokeUrlsDialog.
 */
export function derivePrimaryUrl(
  endpoints: EndpointInfo[],
): PrimaryEndpointUrl | null {
  for (const ep of endpoints) {
    const externals = Object.values(ep.externalURLs ?? {});
    if (externals.length > 0) {
      return { label: 'External', url: buildUrl(externals[0]) };
    }
  }
  for (const ep of endpoints) {
    const internals = Object.values(ep.internalURLs ?? {});
    if (internals.length > 0) {
      return { label: 'Internal', url: buildUrl(internals[0]) };
    }
  }
  for (const ep of endpoints) {
    if (ep.serviceURL) {
      return { label: 'Project', url: buildServiceUrl(ep.serviceURL) };
    }
  }
  return null;
}

/**
 * Extracts the invoke URL from resource tree data by finding HTTPRoute nodes
 * and constructing the URL from hostname and path prefix.
 */
export function extractInvokeUrlFromTree(
  resourceTreeData: ResourceTreeData | null,
  port: number = 19080,
): string | null {
  if (!resourceTreeData?.renderedReleases) return null;

  for (const release of resourceTreeData.renderedReleases) {
    for (const node of release.nodes) {
      if (node.kind !== 'HTTPRoute') continue;

      try {
        const httpRouteObj = node.object as any;
        const hostname = httpRouteObj?.spec?.hostnames?.[0];
        const pathValue =
          httpRouteObj?.spec?.rules?.[0]?.matches?.[0]?.path?.value;

        if (!hostname) continue;

        return pathValue
          ? `http://${hostname}:${port}${pathValue}`
          : `http://${hostname}:${port}`;
      } catch {
        continue;
      }
    }
  }

  return null;
}
