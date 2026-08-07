import { useCallback, useMemo, useState } from 'react';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { markEntityForDeletionLocally } from '../utils/deletionUtils';

export interface UsePendingDeletionOverlayResult {
  /** Record that this entity was deleted from the listing this session. */
  markDeleted: (entity: Entity) => void;
  /** Re-map a fetched entity list, marking pending deletions. */
  overlay: (entities: Entity[]) => Entity[];
}

/**
 * Tracks entities deleted from a listing this session and overlays the
 * "marked for deletion" annotation on top of fetched rows until the catalog
 * catches up.
 *
 * A delete only updates the control plane; the catalog entity (and therefore
 * the listing row) lags behind by a sync/event, so without this the row would
 * briefly look alive — and clickable — after a confirmed delete. Pending
 * deletions are keyed by entity identity, not object reference, so overlaying
 * survives refetches.
 */
export function usePendingDeletionOverlay(): UsePendingDeletionOverlayResult {
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(
    () => new Set(),
  );

  const markDeleted = useCallback((entity: Entity) => {
    setPendingDeletions(prev => {
      const next = new Set(prev);
      next.add(stringifyEntityRef(entity));
      return next;
    });
  }, []);

  const overlay = useCallback(
    (entities: Entity[]) =>
      pendingDeletions.size === 0
        ? entities
        : entities.map(entity =>
            pendingDeletions.has(stringifyEntityRef(entity))
              ? markEntityForDeletionLocally(entity)
              : entity,
          ),
    [pendingDeletions],
  );

  return useMemo(() => ({ markDeleted, overlay }), [markDeleted, overlay]);
}
