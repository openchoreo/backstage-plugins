import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { DataPlane } from '../types';

export async function fetchAllDataplanes(
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<DataPlane[]> {
  const backendUrl = `${await discovery.getBaseUrl(
    'platform-engineer-core',
  )}/dataplanes`;

  const res = await fetchApi.fetch(backendUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch dataplanes: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`API error: ${data.error || 'Unknown error'}`);
  }

  return data.data || [];
}

export async function fetchDataplanesByNamespace(
  namespaceName: string,
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<DataPlane[]> {
  const backendUrl = `${await discovery.getBaseUrl(
    'platform-engineer-core',
  )}/dataplanes/${namespaceName}`;

  const res = await fetchApi.fetch(backendUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch dataplanes for ${namespaceName}: ${res.statusText}`,
    );
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`API error: ${data.error || 'Unknown error'}`);
  }

  return data.data || [];
}
