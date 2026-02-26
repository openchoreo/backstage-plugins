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

/**
 * BFS from selectedProjectRefs, but never traverse through a project (System)
 * node that isn't selected. This prevents shared entities (e.g. environments)
 * from bridging deselected projects back into the result.
 */
function filterGraphByReachability(
  nodes: EntityNode[],
  edges: EntityEdge[],
  selectedProjectRefs: string[],
  allProjectRefs: string[],
): { nodes: EntityNode[]; edges: EntityEdge[] } {
  const excludedProjects = new Set(allProjectRefs);
  for (const ref of selectedProjectRefs) {
    excludedProjects.delete(ref);
  }

  // Build undirected adjacency from edges
  const adj = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, new Set());
    if (!adj.has(edge.to)) adj.set(edge.to, new Set());
    adj.get(edge.from)!.add(edge.to);
    adj.get(edge.to)!.add(edge.from);
  }

  // BFS from selected projects; skip excluded project nodes
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const rootId of selectedProjectRefs) {
    if (!visited.has(rootId)) {
      visited.add(rootId);
      queue.push(rootId);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && !excludedProjects.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return {
    nodes: nodes.filter(n => visited.has(n.id)),
    edges: edges.filter(e => visited.has(e.from) && visited.has(e.to)),
  };
}

export function useEntityGraphData(
  entityRefs: CompoundEntityRef[],
  view: GraphViewDefinition,
  onNodeClick?: (node: EntityNode, event: MouseEvent<unknown>) => void,
  projectRefs?: string[],
  allProjectRefs?: string[],
): UseEntityGraphDataResult {
  const catalogApi = useApi(catalogApiRef);
  const [fullGraph, setFullGraph] = useState<{
    nodes: EntityNode[];
    edges: EntityEdge[];
  }>({ nodes: [], edges: [] });
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

  const projectRefsKey = useMemo(
    () => projectRefs?.slice().sort().join(',') ?? '',
    [projectRefs],
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
            // Merge forward relation if not already present
            if (!existing.relations.includes(left)) {
              existing.relations.push(left);
            }
          } else {
            edgeMap.set(edgeKey, {
              from,
              to,
              relations: [left],
              label: 'visible',
            });
          }
        }
      }

      return { nodes: builtNodes, edges: Array.from(edgeMap.values()) };
    },
    [relationsSet, view.relationPairs, onNodeClick],
  );

  // Fetch entities and build the full (unfiltered) graph
  useEffect(() => {
    if (entityRefs.length === 0) {
      setFullGraph({ nodes: [], edges: [] });
      setError(undefined);
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

        setFullGraph(buildGraph(entityMap));
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

  // Apply project reachability filter client-side (no re-fetch)
  const filtered = useMemo(() => {
    if (
      !projectRefs ||
      projectRefs.length === 0 ||
      !allProjectRefs ||
      fullGraph.nodes.length === 0
    ) {
      return fullGraph;
    }
    const nodeIdSet = new Set(fullGraph.nodes.map(n => n.id));
    const validRoots = projectRefs.filter(ref => nodeIdSet.has(ref));
    if (validRoots.length === 0) return fullGraph;
    return filterGraphByReachability(
      fullGraph.nodes,
      fullGraph.edges,
      validRoots,
      allProjectRefs,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGraph, projectRefsKey, allProjectRefs]);

  return { nodes: filtered.nodes, edges: filtered.edges, loading, error };
}
