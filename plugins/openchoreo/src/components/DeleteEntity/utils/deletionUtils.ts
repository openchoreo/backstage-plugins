import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Checks if an entity is marked for deletion.
 * An entity is marked for deletion if it has the deletion-timestamp annotation.
 */
export function isMarkedForDeletion(entity: Entity): boolean {
  return !!entity.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP];
}

/**
 * Gets the deletion timestamp from an entity, if present.
 */
export function getDeletionTimestamp(entity: Entity): string | undefined {
  return entity.metadata.annotations?.[CHOREO_ANNOTATIONS.DELETION_TIMESTAMP];
}

/**
 * Returns a copy of the entity carrying the deletion-timestamp annotation,
 * so listings can show the "marked for deletion" badge immediately after a
 * delete — before the catalog re-ingests the deletion from the control plane.
 */
export function markEntityForDeletionLocally(entity: Entity): Entity {
  if (isMarkedForDeletion(entity)) {
    return entity;
  }
  return {
    ...entity,
    metadata: {
      ...entity.metadata,
      annotations: {
        ...(entity.metadata.annotations ?? {}),
        [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: new Date().toISOString(),
      },
    },
  };
}
