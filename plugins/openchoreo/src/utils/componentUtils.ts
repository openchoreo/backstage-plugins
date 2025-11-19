import { Entity } from '@backstage/catalog-model';

/**
 * Determines if a component is deployed from source code (requires build)
 * or from a pre-built image.
 *
 * @param entity - Backstage entity representing the component
 * @returns true if component uses from-source deployment (has workflow), false for from-image
 */
export function isFromSourceComponent(entity: Entity): boolean {
  return !!(entity.spec as any)?.workflow;
}
