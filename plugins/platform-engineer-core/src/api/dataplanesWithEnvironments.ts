import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { DataPlaneWithEnvironments } from '../types';

export async function fetchDataplanesWithEnvironments(
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<DataPlaneWithEnvironments[]> {
  const backendUrl = `${await discovery.getBaseUrl(
    'platform-engineer-core',
  )}/dataplanes-with-environments`;

  const res = await fetchApi.fetch(backendUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch dataplanes with environments: ${res.statusText}`,
    );
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`API error: ${data.error || 'Unknown error'}`);
  }

  return data.data || [];
}
