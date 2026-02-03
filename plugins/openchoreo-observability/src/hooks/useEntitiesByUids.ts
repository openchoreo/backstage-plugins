import { useEffect, useState, useMemo, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface EntityInfo {
  name: string;
  title?: string;
  path: string;
}

export type EntityMap = Map<string, EntityInfo>;

const UUID_PATTERN =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;

const ALL_ANNOTATIONS = [
  CHOREO_ANNOTATIONS.COMPONENT_UID,
  CHOREO_ANNOTATIONS.ENVIRONMENT_UID,
  CHOREO_ANNOTATIONS.PROJECT_UID,
];

const KIND_TO_ANNOTATION: Record<string, string> = {
  Component: CHOREO_ANNOTATIONS.COMPONENT_UID,
  Environment: CHOREO_ANNOTATIONS.ENVIRONMENT_UID,
  System: CHOREO_ANNOTATIONS.PROJECT_UID,
};

/**
 * Extracts all UUIDs from text.
 */
export function extractEntityUids(text: string): string[] {
  const uids = new Set<string>();
  for (const m of text.matchAll(UUID_PATTERN)) {
    uids.add(m[0]);
  }
  return Array.from(uids);
}

/**
 * Hook to batch-fetch entities from the catalog by their OpenChoreo UIDs.
 * Caches fetched entities and only queries for new UUIDs.
 */
export function useEntitiesByUids(uids: string[]): {
  entityMap: EntityMap;
  loading: boolean;
  error: Error | undefined;
} {
  const catalogApi = useApi(catalogApiRef);
  const [entityMap, setEntityMap] = useState<EntityMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  // Track UUIDs we've already queried (including ones not found)
  const queriedUidsRef = useRef<Set<string>>(new Set());

  // Find UUIDs we haven't queried yet
  const newUids = useMemo(() => {
    const seen = new Set<string>();
    return uids.filter(uid => {
      if (!uid || seen.has(uid) || queriedUidsRef.current.has(uid)) return false;
      seen.add(uid);
      return true;
    });
  }, [uids]);

  useEffect(() => {
    if (newUids.length === 0) {
      return;
    }

    setLoading(true);
    setError(undefined);

    // Mark these UUIDs as queried
    for (const uid of newUids) {
      queriedUidsRef.current.add(uid);
    }

    // Query across all annotation types for each new UUID
    const filters = newUids.flatMap(uid =>
      ALL_ANNOTATIONS.map(annotation => ({
        [`metadata.annotations.${annotation}`]: uid,
      })),
    );

    catalogApi
      .getEntities({ filter: filters })
      .then(response => {
        if (response.items.length > 0) {
          setEntityMap(prevMap => {
            const newMap = new Map(prevMap);
            for (const entity of response.items) {
              const annotations = entity.metadata.annotations || {};
              const uid = annotations[KIND_TO_ANNOTATION[entity.kind]];

              if (uid && !newMap.has(uid)) {
                const namespace = entity.metadata.namespace || 'default';
                const kind = entity.kind.toLowerCase();
                const name = entity.metadata.name;
                newMap.set(uid, {
                  name,
                  title: entity.metadata.title,
                  path: `/catalog/${namespace}/${kind}/${name}`,
                });
              }
            }
            return newMap;
          });
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [newUids, catalogApi]);

  return { entityMap, loading, error };
}
