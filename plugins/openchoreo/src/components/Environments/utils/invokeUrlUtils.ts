import { ReleaseData } from '../ReleaseDataRenderer/types';

/**
 * Extracts the invoke URL from release data by finding HTTPRoute resources
 * and constructing the URL from hostname and path prefix.
 *
 * @param releaseData - The release data containing HTTPRoute information
 * @param port - The HTTP port to use (defaults to 19080)
 */
export function extractInvokeUrl(
  releaseData: ReleaseData | null,
  port: number = 19080,
): string | null {
  if (!releaseData?.data) {
    return null;
  }

  // Check spec.resources for HTTPRoute definition
  const specResources = releaseData.data.spec?.resources || [];

  // Find HTTPRoute in spec resources
  const httpRouteSpec = specResources.find(resource => {
    const obj = resource.object as Record<string, unknown>;
    return obj?.kind === 'HTTPRoute';
  });

  if (!httpRouteSpec) {
    return null;
  }

  try {
    const httpRouteObj = httpRouteSpec.object as any;

    // Extract hostname from spec.hostnames[0]
    const hostname = httpRouteObj.spec?.hostnames?.[0];

    // Extract path prefix from spec.rules[0].matches[0].path.value
    const pathValue = httpRouteObj.spec?.rules?.[0]?.matches?.[0]?.path?.value;

    if (!hostname) {
      return null;
    }

    // Construct the invoke URL
    // Format: http://{hostname}:{port}{path} or just http://{hostname}:{port} if no path
    const url = pathValue
      ? `http://${hostname}:${port}${pathValue}`
      : `http://${hostname}:${port}`;
    return url;
  } catch (error) {
    // If there's any error parsing the structure, return null
    return null;
  }
}
