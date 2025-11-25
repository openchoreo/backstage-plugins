import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { ModelsWorkload } from '@openchoreo/backstage-plugin-common';
import { API_ENDPOINTS } from '../constants';
import { apiFetch } from './client';
import {
  extractEntityMetadata,
  entityMetadataToParams,
} from '../utils/entityUtils';

export async function fetchWorkloadInfo(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<ModelsWorkload> {
  const metadata = extractEntityMetadata(entity);

  return apiFetch<ModelsWorkload>({
    endpoint: API_ENDPOINTS.DEPLOYEMNT_WORKLOAD,
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });
}

export async function applyWorkload(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  workloadSpec: ModelsWorkload,
) {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.DEPLOYEMNT_WORKLOAD,
    discovery,
    identity,
    method: 'POST',
    params: entityMetadataToParams(metadata),
    body: workloadSpec,
  });
}
