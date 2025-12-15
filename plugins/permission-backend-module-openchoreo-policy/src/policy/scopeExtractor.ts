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

/**
 * Extracts organization from JWT token claims.
 *
 * This is used for non-entity permissions where we need to determine
 * the org context from the user's identity.
 *
 * @param userToken - The user's OpenChoreo IDP token (JWT)
 * @returns The organization from the token claims, or undefined
 */
export function extractOrgFromToken(userToken: string): string | undefined {
  try {
    // JWT format: header.payload.signature
    const parts = userToken.split('.');
    if (parts.length !== 3) {
      return undefined;
    }

    // Decode the payload (base64url)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const claims = JSON.parse(decoded);

    // Look for org claim - adjust claim name based on your IDP configuration
    return (
      claims.org ||
      claims.organization ||
      claims['openchoreo/org'] ||
      claims['https://openchoreo.com/org']
    );
  } catch {
    return undefined;
  }
}
