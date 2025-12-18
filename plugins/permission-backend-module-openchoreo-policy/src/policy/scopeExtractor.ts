import { CatalogApi } from '@backstage/catalog-client';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoScope } from '../services';

/**
 * Extracts the OpenChoreo scope (org/project/component) from a catalog entity.
 *
 * @param catalogApi - Catalog API client
 * @param entityRef - Entity reference (e.g., 'component:default/my-component')
 * @param token - Service token for catalog API calls
 * @returns The scope extracted from entity annotations, or undefined if not found
 */
export async function extractScopeFromEntity(
  catalogApi: CatalogApi,
  entityRef: string,
  token: string,
): Promise<OpenChoreoScope | undefined> {
  try {
    const entity = await catalogApi.getEntityByRef(entityRef, { token });

    if (!entity) {
      return undefined;
    }

    const org = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    if (!org) {
      return undefined;
    }

    return {
      org,
      project: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT],
      component: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT],
    };
  } catch {
    return undefined;
  }
}
