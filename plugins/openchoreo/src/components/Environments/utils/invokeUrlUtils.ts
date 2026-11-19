import type {
  EndpointInfo,
  EndpointURLDetails,
  EndpointURLSecurity,
} from '../hooks/useEnvironmentData';
import type { ResourceTreeData } from '../ReleaseDataRenderer/types';

/**
 * Build a full URL from EndpointURLDetails, including path. A URL without a
 * scheme, such as an Endpoint's TCP address, is shown as host and port.
 */
export function buildUrl(details: EndpointURLDetails): string {
  const schemePart = details.scheme ? `${details.scheme}://` : '';
  const portPart = details.port ? `:${details.port}` : '';
  const pathPart = details.path || '';
  return `${schemePart}${details.host}${portPart}${pathPart}`;
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
  label: 'External' | 'Internal' | 'Namespace' | 'Project';
  url: string;
}

/**
 * The project-visibility URL of an endpoint: the one its Endpoint resolved,
 * which may carry a path, or else the in-cluster service URL.
 */
export function projectUrlOf(endpoint: EndpointInfo): string | null {
  if (endpoint.projectURL) return buildUrl(endpoint.projectURL);
  if (endpoint.serviceURL) return buildServiceUrl(endpoint.serviceURL);
  return null;
}

/**
 * Pick a single representative URL across all endpoints. Falls back
 * external → internal → namespace → project → null. Used by the
 * Endpoints section in the env detail panel for an at-a-glance preview;
 * the full list lives in InvokeUrlsDialog.
 */
export function derivePrimaryUrl(
  endpoints: EndpointInfo[],
): PrimaryEndpointUrl | null {
  const scoped: Array<
    [
      PrimaryEndpointUrl['label'],
      'externalURLs' | 'internalURLs' | 'namespaceURLs',
    ]
  > = [
    ['External', 'externalURLs'],
    ['Internal', 'internalURLs'],
    ['Namespace', 'namespaceURLs'],
  ];
  for (const [label, key] of scoped) {
    for (const ep of endpoints) {
      const urls = Object.values(ep[key] ?? {});
      if (urls.length > 0) {
        return { label, url: buildUrl(urls[0]) };
      }
    }
  }
  for (const ep of endpoints) {
    const url = projectUrlOf(ep);
    if (url) return { label: 'Project', url };
  }
  return null;
}

/**
 * Describes what a caller must present at a URL, e.g. "API key (header
 * api-key)". Returns null when the URL declares no security, which is the
 * case for every URL that comes from a ReleaseBinding.
 */
export function describeSecurity(
  security: EndpointURLSecurity | undefined,
): string | null {
  if (!security) return null;
  switch (security.scheme) {
    case 'apiKey':
      return security.apiKey
        ? `API key (${security.apiKey.in} ${security.apiKey.name})`
        : 'API key';
    case 'oauth2':
      return 'OAuth2';
    case 'basicAuth':
      return 'Basic auth';
    case 'none':
      return 'No authentication';
    default:
      return null;
  }
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
