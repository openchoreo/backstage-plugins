import { useEffect, useState, useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface EntityInfo {
  name: string;
  title?: string;
  path: string;
}

export type EntityMap = Map<string, EntityInfo>;

export interface EntityRef {
  type: 'comp' | 'env' | 'proj';
  uid: string;
}

const TAGGED_PATTERN = /\{\{(comp|env|proj):([a-f0-9-]{36})\}\}/gi;
const UUID_PATTERN =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;

const TYPE_CONFIG: Record<
  EntityRef['type'],
  { kind: string; annotation: string }
> = {
  comp: { kind: 'Component', annotation: CHOREO_ANNOTATIONS.COMPONENT_UID },
  env: { kind: 'Environment', annotation: CHOREO_ANNOTATIONS.ENVIRONMENT_UID },
  proj: { kind: 'System', annotation: CHOREO_ANNOTATIONS.PROJECT_UID },
};

const KIND_TO_ANNOTATION = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([_, { kind, annotation }]) => [
    kind,
    annotation,
  ]),
) as Record<string, string>;

const ALL_ANNOTATIONS = Object.values(TYPE_CONFIG).map(c => c.annotation);

/**
 * Extracts all entity references from text.
 * Returns tagged refs (with known type) and orphan UUIDs (untagged).
 */
export function extractEntityUids(text: string): {
  tagged: EntityRef[];
  orphans: string[];
} {
  const tagged: EntityRef[] = [];
  const taggedUids = new Set<string>();

  // Find tagged patterns
  for (const m of text.matchAll(TAGGED_PATTERN)) {
    if (!taggedUids.has(m[2])) {
      taggedUids.add(m[2]);
      tagged.push({ type: m[1].toLowerCase() as EntityRef['type'], uid: m[2] });
    }
  }

  // Find orphan UUIDs (not tagged)
  const orphans: string[] = [];
  for (const m of text.matchAll(UUID_PATTERN)) {
    if (!taggedUids.has(m[0])) {
      taggedUids.add(m[0]); // prevent duplicates
      orphans.push(m[0]);
    }
  }

  return { tagged, orphans };
}

/**
 * Hook to batch-fetch entities from the catalog by their OpenChoreo UIDs.
 */
export function useEntitiesByUids(
  tagged: EntityRef[],
  orphans: string[] = [],
): {
  entityMap: EntityMap;
  loading: boolean;
  error: Error | undefined;
} {
  const catalogApi = useApi(catalogApiRef);
  const [entityMap, setEntityMap] = useState<EntityMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const { uniqueTagged, uniqueOrphans } = useMemo(() => {
    const seen = new Set<string>();
    const filteredTagged = tagged.filter(ref => {
      if (!ref.uid || seen.has(ref.uid)) return false;
      seen.add(ref.uid);
      return true;
    });
    const filteredOrphans = orphans.filter(uid => {
      if (!uid || seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });
    return { uniqueTagged: filteredTagged, uniqueOrphans: filteredOrphans };
  }, [tagged, orphans]);

  useEffect(() => {
    if (uniqueTagged.length === 0 && uniqueOrphans.length === 0) {
      setEntityMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    // Tagged: query with known type
    const taggedFilters = uniqueTagged.map(({ type, uid }) => ({
      kind: TYPE_CONFIG[type].kind,
      [`metadata.annotations.${TYPE_CONFIG[type].annotation}`]: uid,
    }));

    // Orphans: query across all annotation types
    const orphanFilters = uniqueOrphans.flatMap(uid =>
      ALL_ANNOTATIONS.map(annotation => ({
        [`metadata.annotations.${annotation}`]: uid,
      })),
    );

    catalogApi
      .getEntities({ filter: [...taggedFilters, ...orphanFilters] })
      .then(response => {
        const map = new Map<string, EntityInfo>();
        for (const entity of response.items) {
          const annotations = entity.metadata.annotations || {};
          const uid = annotations[KIND_TO_ANNOTATION[entity.kind]];

          if (uid) {
            const namespace = entity.metadata.namespace || 'default';
            const kind = entity.kind.toLowerCase();
            const name = entity.metadata.name;
            map.set(uid, {
              name,
              title: entity.metadata.title,
              path: `/catalog/${namespace}/${kind}/${name}`,
            });
          }
        }
        setEntityMap(map);
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [uniqueTagged, uniqueOrphans, catalogApi]);

  return { entityMap, loading, error };
}
