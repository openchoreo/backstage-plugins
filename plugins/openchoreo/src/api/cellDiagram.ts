import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { API_ENDPOINTS } from '../constants';
import { apiFetch } from './client';

export async function getCellDiagramInfo(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
) {
  const project = entity.metadata.name;
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !organization) {
    return [];
  }

  return apiFetch({
    endpoint: API_ENDPOINTS.CELL_DIAGRAM,
    discovery,
    identity,
    params: {
      projectName: project,
      organizationName: organization,
    },
  });
}
