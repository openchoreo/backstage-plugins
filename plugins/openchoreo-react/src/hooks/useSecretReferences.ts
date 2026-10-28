import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import { openChoreoFetchApiRef } from '../api/openChoreoFetchApi';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

/** Information about a secret key in a secret reference */
export interface SecretDataSourceInfo {
  secretKey: string;
  remoteRef: {
    key: string;
  };
}

/** A secret reference with its metadata and available keys */
export interface SecretReference {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  data?: SecretDataSourceInfo[];
  /** Plane that hosts the secret value. Unset for legacy refs reachable via spec.data. */
  targetPlane?: { kind?: string; name: string };
  createdAt: string;
  status: string;
}

/**
 * Filter to references usable in a workload deployed to a given environment:
 * either no `targetPlane` (unscoped / legacy) or `targetPlane` matches the
 * env's data plane by **both** kind and name. Plane refs of any other kind
 * (e.g. WorkflowPlane) are excluded — they cannot be mounted into a workload
 * running on a different plane.
 */
export function filterSecretReferencesForEnvDataPlane(
  refs: SecretReference[],
  envDataPlane: { kind?: string; name?: string } | undefined,
): SecretReference[] {
  return refs.filter(ref => {
    if (!ref.targetPlane) return true;
    if (!envDataPlane?.name || !envDataPlane.kind) return false;
    return (
      ref.targetPlane.kind === envDataPlane.kind &&
      ref.targetPlane.name === envDataPlane.name
    );
  });
}

/** Plane kinds whose secret store an observability plane reads. */
const OBSERVABILITY_PLANE_KINDS = [
  'ObservabilityPlane',
  'ClusterObservabilityPlane',
];

/**
 * Filter to references a notification channel can use: either no `targetPlane`
 * (unscoped / legacy) or a `targetPlane` that is an observability plane. The
 * controller checks that it is the channel environment's observability plane.
 */
export function filterSecretReferencesForObservabilityPlane(
  refs: SecretReference[],
): SecretReference[] {
  return refs.filter(
    ref =>
      !ref.targetPlane ||
      OBSERVABILITY_PLANE_KINDS.includes(ref.targetPlane.kind ?? ''),
  );
}

interface SecretReferencesResponse {
  success: boolean;
  data: {
    items: SecretReference[];
  };
}

async function fetchSecretReferences(
  namespaceName: string | undefined,
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<SecretReferencesResponse> {
  if (!namespaceName) {
    throw new Error('Missing namespace annotation');
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}/secret-references`,
  );

  const params = new URLSearchParams({
    namespaceName,
  });
  backendUrl.search = params.toString();

  const res = await fetchApi.fetch(backendUrl.toString());

  if (!res.ok) {
    throw new Error('Failed to fetch secret references');
  }

  return res.json();
}

export interface UseSecretReferencesResult {
  /** List of available secret references */
  secretReferences: SecretReference[];
  /** Whether the hook is currently loading data */
  isLoading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  /** Error message if the fetch failed */
  error: string | null;
}

/**
 * Hook to fetch secret references for the current entity's namespace.
 * Automatically fetches on mount and cleans up on unmount.
 *
 * @returns Object containing secretReferences array, isLoading flag, and error message
 */
export function useSecretReferences(): UseSecretReferencesResult {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(openChoreoFetchApiRef);
  const { entity } = useEntity();

  const { data, loading, isRefetching, error } = useOpenChoreoQuery<
    SecretReference[]
  >(['secret-references', stringifyEntityRef(entity)], async () => {
    const response = await fetchSecretReferences(
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE],
      discovery,
      fetchApi,
    );
    return response.success && response.data.items ? response.data.items : [];
  });

  return {
    secretReferences: data ?? [],
    isLoading: loading,
    isRefetching,
    // Preserve the original generic message (never leaked the raw error text).
    error: error ? 'Failed to fetch secret references' : null,
  };
}

/**
 * Hook to fetch secret references for a namespace, for components that are not
 * rendered on an entity page (e.g. scaffolder fields). Does not fetch until a
 * namespace is given.
 *
 * @param namespaceName - Namespace to list secret references in
 * @returns Object containing secretReferences array, isLoading flag, and error message
 */
export function useNamespaceSecretReferences(
  namespaceName: string | undefined,
): UseSecretReferencesResult {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(openChoreoFetchApiRef);

  const { data, loading, isRefetching, error } = useOpenChoreoQuery<
    SecretReference[]
  >(
    ['secret-references', 'namespace', namespaceName ?? null],
    async () => {
      const response = await fetchSecretReferences(
        namespaceName,
        discovery,
        fetchApi,
      );
      return response.success && response.data.items ? response.data.items : [];
    },
    { enabled: Boolean(namespaceName) },
  );

  return {
    secretReferences: data ?? [],
    isLoading: loading,
    isRefetching,
    error: error ? 'Failed to fetch secret references' : null,
  };
}
