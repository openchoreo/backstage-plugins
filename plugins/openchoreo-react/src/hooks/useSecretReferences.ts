import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';
import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

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

interface SecretReferencesResponse {
  success: boolean;
  data: {
    items: SecretReference[];
  };
}

async function fetchSecretReferences(
  entity: Entity,
  discovery: DiscoveryApi,
  fetchApi: FetchApi,
): Promise<SecretReferencesResponse> {
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

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
  const fetchApi = useApi(fetchApiRef);
  const { entity } = useEntity();
  const [secretReferences, setSecretReferences] = useState<SecretReference[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchSecretReferences(
          entity,
          discovery,
          fetchApi,
        );
        if (response.success && response.data.items) {
          setSecretReferences(response.data.items);
        }
      } catch (err) {
        setError('Failed to fetch secret references');
        setSecretReferences([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecrets();

    return () => {
      setSecretReferences([]);
      setError(null);
    };
  }, [entity, discovery, fetchApi]);

  return { secretReferences, isLoading, error };
}
