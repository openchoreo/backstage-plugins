import { ReleaseData } from '../ReleaseDataRenderer/types';

/**
 * Extracts the invoke URL from release data by finding HTTPRoute resources
 * and constructing the URL from hostname and path prefix.
 *
 */
export function extractInvokeUrl(
  releaseData: ReleaseData | null,
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
    // Format: http://{hostname}:19080{path} or just http://{hostname}:19080 if no path
    const url = pathValue
      ? `http://${hostname}:19080${pathValue}`
      : `http://${hostname}:19080`;
    return url;
  } catch (error) {
    // If there's any error parsing the structure, return null
    return null;
  }
}
