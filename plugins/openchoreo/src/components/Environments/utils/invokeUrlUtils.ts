import type { ResourceTreeData } from '../ReleaseDataRenderer/types';

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
