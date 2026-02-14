import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CompoundEntityRef,
  Entity,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  EntityNode,
  EntityEdge,
  EntityNodeData,
} from '@backstage/plugin-catalog-graph';
import type { GraphViewDefinition } from '../utils/platformOverviewConstants';

export interface UseEntityGraphDataResult {
  nodes: EntityNode[];
  edges: EntityEdge[];
  loading: boolean;
  error: Error | undefined;
}

export function useEntityGraphData(
  entityRefs: CompoundEntityRef[],
  view: GraphViewDefinition,
  onNodeClick?: (node: EntityNode, event: MouseEvent<unknown>) => void,
): UseEntityGraphDataResult {
  const catalogApi = useApi(catalogApiRef);
  const [nodes, setNodes] = useState<EntityNode[]>([]);
  const [edges, setEdges] = useState<EntityEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();

  // Stable serialized key for entityRefs to avoid unnecessary re-fetches
  const refsKey = useMemo(
    () =>
      entityRefs
        .map(r => stringifyEntityRef(r))
        .sort()
        .join(','),
    [entityRefs],
  );

  const relationsSet = useMemo(() => new Set(view.relations), [view.relations]);

  const buildGraph = useCallback(
    (entities: Map<string, Entity>) => {
      const builtNodes: EntityNode[] = [];
      const edgeMap = new Map<string, EntityEdge>();

      // Build nodes
      for (const [ref, entity] of entities) {
        const clickHandler = onNodeClick
          ? (event: MouseEvent<unknown>) => {
              const node: EntityNode = {
                id: ref,
                entity,
                focused: false,
                color: 'primary',
                name: entity.metadata.name,
                kind: entity.kind,
                namespace: entity.metadata.namespace ?? 'default',
                title: entity.metadata.title,
                spec: entity.spec as EntityNodeData['spec'],
              };
              onNodeClick(node, event);
            }
          : undefined;

        builtNodes.push({
          id: ref,
          entity,
          focused: false,
          color: 'primary',
          onClick: clickHandler,
          name: entity.metadata.name,
          kind: entity.kind,
          namespace: entity.metadata.namespace ?? 'default',
          title: entity.metadata.title,
          spec: entity.spec as EntityNodeData['spec'],
        });
      }

      // Build edges
      for (const [entityRef, entity] of entities) {
        if (!entity.relations) continue;

        for (const rel of entity.relations) {
          if (!relationsSet.has(rel.type)) continue;
          if (!entities.has(rel.targetRef)) continue;

          // Find the relation pair containing this type
          const pair = view.relationPairs.find(
            ([l, r]) => l === rel.type || r === rel.type,
          ) ?? [rel.type];

          // Normalize direction: pair[0] is the "forward" direction
          const [left] = pair;
          const from = left === rel.type ? entityRef : rel.targetRef;
          const to = left === rel.type ? rel.targetRef : entityRef;

          const edgeKey = `${from}|${to}`;
          const existing = edgeMap.get(edgeKey);

          if (existing) {
            // Merge relation types if not already present
            for (const p of pair) {
              if (p && !existing.relations.includes(p)) {
                existing.relations.push(p);
              }
            }
          } else {
            edgeMap.set(edgeKey, {
              from,
              to,
              relations: [...pair].filter((p): p is string => !!p),
              label: 'visible',
            });
          }
        }
      }

      return { nodes: builtNodes, edges: Array.from(edgeMap.values()) };
    },
    [relationsSet, view.relationPairs, onNodeClick],
  );

  useEffect(() => {
    if (entityRefs.length === 0) {
      setNodes([]);
      setEdges([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function fetchAndBuild() {
      try {
        setLoading(true);
        setError(undefined);

        const refs = entityRefs.map(r => stringifyEntityRef(r));
        const response = await catalogApi.getEntitiesByRefs({
          entityRefs: refs,
        });

        if (cancelled) return;

        // Build entity map from results
        const entityMap = new Map<string, Entity>();
        response.items.forEach((entity, i) => {
          if (entity) {
            entityMap.set(refs[i], entity);
          }
        });

        const { nodes: builtNodes, edges: builtEdges } = buildGraph(entityMap);

        setNodes(builtNodes);
        setEdges(builtEdges);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAndBuild();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogApi, refsKey, buildGraph]);

  return { nodes, edges, loading, error };
}
