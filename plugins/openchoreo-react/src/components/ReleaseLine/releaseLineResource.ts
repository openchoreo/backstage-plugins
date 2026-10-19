import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { ReleaseLineResource } from '@openchoreo/backstage-plugin-common';

interface ReleaseLineRef {
  namespaceName: string;
  componentName: string;
  releaseLineName: string;
}

/** Fetches a release line of a component. */
export async function fetchReleaseLineResource(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  ref: ReleaseLineRef,
): Promise<ReleaseLineResource> {
  const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
  const params = new URLSearchParams({ ...ref });
  const response = await fetchApi.fetch(
    `${baseUrl}/release-line?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()).data;
}

/** Replaces a release line's spec, i.e. its overrides. */
export async function updateReleaseLineResource(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  ref: ReleaseLineRef,
  releaseLine: ReleaseLineResource,
): Promise<ReleaseLineResource> {
  const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
  const response = await fetchApi.fetch(`${baseUrl}/release-line`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ref, releaseLine }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()).data;
}
