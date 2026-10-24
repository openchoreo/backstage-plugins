import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

/**
 * Starts a build of a release line through the component's workflow-run API,
 * which applies the line's workflow parameter overrides.
 */
export async function triggerReleaseLineBuild(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  request: {
    componentName: string;
    namespaceName: string;
    releaseLine: string;
  },
): Promise<void> {
  const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
  const response = await fetchApi.fetch(`${baseUrl}/release-line-builds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}
