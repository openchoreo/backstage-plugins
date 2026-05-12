import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

export interface UseDataPlaneNetPolProviderResult {
  networkPolicyProvider: string | undefined;
  loading: boolean;
}

/**
 * Fetches the `openchoreo.dev/networkpolicyprovider` annotation from the
 * DataPlane or ClusterDataPlane CR referenced by the given dataPlaneRef.
 *
 * @param namespaceName - The namespace of the DataPlane/ClusterDataPlane
 * @param dataPlaneRef - Reference to the DataPlane/ClusterDataPlane (must include `name`, `kind` is optional and defaults to 'DataPlane')
 * @returns Object containing the network policy provider (e.g. 'cilium') and loading state
 *
 * Note: The observability backend returns `null` if the annotation is not set, which is treated as `undefined` here.
 * Returns `undefined` (not loading) when namespaceName or dataPlaneRef.name
 * is absent — callers treat this as "no HTTP metrics".
 */
export const useDataPlaneNetPolProvider = (
  namespaceName: string | undefined,
  dataPlaneRef: { kind?: string; name?: string } | undefined,
): UseDataPlaneNetPolProviderResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [networkPolicyProvider, setNetworkPolicyProvider] = useState<
    string | undefined
  >(undefined);
  const [loading, setLoading] = useState(false);

  const dpName = dataPlaneRef?.name;
  const dpKind = dataPlaneRef?.kind ?? 'DataPlane';

  useEffect(() => {
    const fetchDataPlaneNetPolProvider = async () => {
      if (!namespaceName || !dpName) {
        setNetworkPolicyProvider(undefined);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-observability-backend',
        );
        const params = new URLSearchParams({ namespaceName, dpName, dpKind });
        const response = await fetchApi.fetch(
          `${baseUrl}/dataplane-netpol-provider?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch network policy provider: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        setNetworkPolicyProvider(data.networkPolicyProvider);
      } catch (error) {
        setNetworkPolicyProvider(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchDataPlaneNetPolProvider();
  }, [namespaceName, dpName, dpKind, discoveryApi, fetchApi]);

  return { networkPolicyProvider, loading };
};
