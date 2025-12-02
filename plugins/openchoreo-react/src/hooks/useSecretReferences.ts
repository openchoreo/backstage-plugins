import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';
import type { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';

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
  createdAt: string;
  status: string;
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
  identity: IdentityApi,
): Promise<SecretReferencesResponse> {
  const { token } = await identity.getCredentials();
  const organizationName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!organizationName) {
    throw new Error('Missing organization annotation');
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}/secret-references`,
  );

  const params = new URLSearchParams({
    organizationName,
  });
  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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
 * Hook to fetch secret references for the current entity's organization.
 * Automatically fetches on mount and cleans up on unmount.
 *
 * @returns Object containing secretReferences array, isLoading flag, and error message
 */
export function useSecretReferences(): UseSecretReferencesResult {
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
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
          identity,
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
  }, [entity, discovery, identity]);

  return { secretReferences, isLoading, error };
}
