import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

export interface UseDataPlaneNetPolProviderResult {
  networkPolicyProvider: string | undefined;
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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

  const dpName = dataPlaneRef?.name;
  const dpKind = dataPlaneRef?.kind ?? 'DataPlane';

  const { data, loading, isRefetching } = useOpenChoreoQuery(
    [
      'dataplane-netpol-provider',
      namespaceName ?? null,
      dpName ?? null,
      dpKind,
    ],
    async () => {
      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-observability-backend',
      );
      const params = new URLSearchParams({
        namespaceName: namespaceName!,
        dpName: dpName!,
        dpKind,
      });
      const response = await fetchApi.fetch(
        `${baseUrl}/dataplane-netpol-provider?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch network policy provider: ${response.status} ${response.statusText}`,
        );
      }
      const json = await response.json();
      return typeof json?.networkPolicyProvider === 'string'
        ? json.networkPolicyProvider
        : undefined;
    },
    {
      enabled: !!namespaceName && !!dpName,
    },
  );

  return { networkPolicyProvider: data ?? undefined, loading, isRefetching };
};
