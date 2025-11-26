import { Entity } from '@backstage/catalog-model';
import { API_ENDPOINTS } from '../constants/api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';

// Using the types from the backend service
export interface SecretReference {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  data?: SecretDataSourceInfo[];
  createdAt: string;
  status: string;
}

export interface SecretDataSourceInfo {
  secretKey: string;
  remoteRef: {
    key: string;
  };
}

export interface SecretReferencesResponse {
  success: boolean;
  data: {
    items: SecretReference[];
  };
}

export async function fetchSecretReferences(
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
    `${await discovery.getBaseUrl('openchoreo')}${API_ENDPOINTS.SECRET_REFERENCES}`,
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