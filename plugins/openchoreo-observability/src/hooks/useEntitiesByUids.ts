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

const ENTITY_PATTERN = /\{\{(comp|env|proj):([a-f0-9-]{36})\}\}/gi;

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

/**
 * Extracts all entity references from text containing {{type:uuid}} patterns.
 */
export function extractEntityUids(text: string): EntityRef[] {
  const matches = text.matchAll(ENTITY_PATTERN);
  const seen = new Set<string>();
  const result: EntityRef[] = [];
  for (const m of matches) {
    if (!seen.has(m[2])) {
      seen.add(m[2]);
      result.push({ type: m[1].toLowerCase() as EntityRef['type'], uid: m[2] });
    }
  }
  return result;
}

/**
 * Hook to batch-fetch entities from the catalog by their OpenChoreo UIDs.
 */
export function useEntitiesByUids(refs: EntityRef[]): {
  entityMap: EntityMap;
  loading: boolean;
  error: Error | undefined;
} {
  const catalogApi = useApi(catalogApiRef);
  const [entityMap, setEntityMap] = useState<EntityMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const uniqueRefs = useMemo(() => {
    const seen = new Set<string>();
    return refs.filter(ref => {
      if (!ref.uid || seen.has(ref.uid)) return false;
      seen.add(ref.uid);
      return true;
    });
  }, [refs]);

  useEffect(() => {
    if (uniqueRefs.length === 0) {
      setEntityMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    const filters = uniqueRefs.map(({ type, uid }) => ({
      kind: TYPE_CONFIG[type].kind,
      [`metadata.annotations.${TYPE_CONFIG[type].annotation}`]: uid,
    }));

    catalogApi
      .getEntities({ filter: filters })
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
  }, [uniqueRefs, catalogApi]);

  return { entityMap, loading, error };
}
