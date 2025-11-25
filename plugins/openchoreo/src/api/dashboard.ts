import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { API_ENDPOINTS } from '../constants';
import { apiFetch } from './client';

export interface ComponentInfo {
  orgName: string;
  projectName: string;
  componentName: string;
}

export async function fetchTotalBindingsCount(
  components: ComponentInfo[],
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<number> {
  const data = await apiFetch<{ totalBindings: number }>({
    endpoint: API_ENDPOINTS.DASHBOARD_BINDINGS_COUNT,
    discovery,
    identity,
    method: 'POST',
    body: { components },
  });

  return data.totalBindings;
}
