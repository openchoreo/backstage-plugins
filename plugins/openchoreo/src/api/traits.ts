import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { API_ENDPOINTS } from '../constants';
import { apiFetch } from './client';
import {
  extractEntityMetadata,
  entityMetadataToParams,
} from '../utils/entityUtils';

/** Component trait response */
export interface ComponentTrait {
  name: string;
  instanceName: string;
  parameters?: Record<string, unknown>;
}

/** Update component traits request */
export interface UpdateComponentTraitsRequest {
  traits: ComponentTrait[];
}

/**
 * Fetch all traits attached to a component
 */
export async function fetchComponentTraits(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<ComponentTrait[]> {
  const metadata = extractEntityMetadata(entity);

  const response = await apiFetch<ComponentTrait[]>({
    endpoint: API_ENDPOINTS.COMPONENT_TRAITS,
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });

  return response || [];
}

/**
 * Update all traits on a component (replaces existing traits)
 */
export async function updateComponentTraits(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  traits: ComponentTrait[],
): Promise<ComponentTrait[]> {
  const metadata = extractEntityMetadata(entity);

  const response = await apiFetch<ComponentTrait[]>({
    endpoint: API_ENDPOINTS.COMPONENT_TRAITS,
    discovery,
    identity,
    method: 'PUT',
    body: {
      organizationName: metadata.organization,
      projectName: metadata.project,
      componentName: metadata.component,
      traits,
    },
  });

  return response || [];
}
