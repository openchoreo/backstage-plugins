import dagre from '@dagrejs/dagre';
import type {
  PipelineNode,
  LayoutPipelineNode,
  PipelineEdge,
  PipelineLayout,
  EdgeLine,
} from './pipelineTypes';

const SETUP_NODE_ID = '__setup__';

export const ENV_NODE_WIDTH = 280;
export const ENV_NODE_HEIGHT = 380;
export const SETUP_NODE_WIDTH = 280;
// Same height as env nodes so dagre aligns them on the same row;
// the setup card content is shorter and centers within this space.
export const SETUP_NODE_HEIGHT = ENV_NODE_HEIGHT;

/** Minimal env shape used by buildEnvPipelineNodes */
export interface EnvPipelineInput {
  name: string;
  promotionTargets?: { name: string; requiresApproval?: boolean }[];
}

/** A promotion path in canonical form (source name + target {name, requiresApproval?}) */
export interface PathPipelineInput {
  source: string;
  targets: { name: string; requiresApproval?: boolean }[];
}

/**
 * Build pipeline DAG nodes from a list of environments. Prepends a
 * synthetic `__setup__` root node and connects environments with no
 * incoming promotions to it. Used by the Environments page canvas.
 */
export function buildEnvPipelineNodes<T extends EnvPipelineInput>(
  environments: T[],
): PipelineNode<T>[] {
  const incomingMap = new Map<
    string,
    { from: string; requiresApproval?: boolean }[]
  >();
  for (const env of environments) {
    incomingMap.set(env.name, []);
  }

  for (const env of environments) {
    if (!env.promotionTargets) continue;
    for (const target of env.promotionTargets) {
      const incoming = incomingMap.get(target.name);
      if (incoming) {
        incoming.push({
          from: env.name,
          requiresApproval: target.requiresApproval,
        });
      }
    }
  }

  const nodes: PipelineNode<T>[] = [
    { id: SETUP_NODE_ID, isSetup: true, parents: [] },
  ];

  for (const env of environments) {
    const incoming = incomingMap.get(env.name) ?? [];
    const parents =
      incoming.length > 0
        ? incoming.map(i => ({
            id: i.from,
            requiresApproval: i.requiresApproval,
          }))
        : [{ id: SETUP_NODE_ID }];
    nodes.push({ id: env.name, isSetup: false, parents, data: env });
  }

  return nodes;
}

/**
 * Build pipeline DAG nodes from promotion paths. No synthetic root —
 * used by the chip-strip mini-DAG inside PipelineFlowVisualization.
 *
 * Multiple paths sharing a source are merged. Multiple paths with the
 * same (source, target) pair de-duplicate to a single edge; if any
 * declares requiresApproval, the merged edge inherits that flag.
 */
export function buildPathPipelineNodes(
  paths: PathPipelineInput[],
): PipelineNode<{ name: string }>[] {
  const allEnvs = new Set<string>();
  // edgeKey -> requiresApproval (sticky-true)
  const incomingByTarget = new Map<string, Map<string, boolean | undefined>>();

  for (const path of paths) {
    if (!path.source) continue;
    allEnvs.add(path.source);
    for (const target of path.targets) {
      if (!target.name) continue;
      allEnvs.add(target.name);
      const incoming = incomingByTarget.get(target.name) ?? new Map();
      const prior = incoming.get(path.source);
      const merged = prior || target.requiresApproval;
      incoming.set(path.source, merged);
      incomingByTarget.set(target.name, incoming);
    }
  }

  const nodes: PipelineNode<{ name: string }>[] = [];
  for (const name of allEnvs) {
    const incoming = incomingByTarget.get(name);
    const parents = incoming
      ? Array.from(incoming.entries()).map(([from, requiresApproval]) => ({
          id: from,
          requiresApproval,
        }))
      : [];
    nodes.push({ id: name, isSetup: false, parents, data: { name } });
  }
  return nodes;
}

/**
 * Compute edge line segments between two positioned nodes (LR direction).
 * Creates L-shaped connectors (3 segments) or a straight line if at same Y.
 */
function computeEdgeLines(
  fromNode: LayoutPipelineNode,
  toNode: LayoutPipelineNode,
): EdgeLine[] {
  const sourceX = fromNode.x + fromNode.width;
  const sourceY = fromNode.y + fromNode.height / 2;
  const targetX = toNode.x;
  const targetY = toNode.y + toNode.height / 2;
  const midX = (sourceX + targetX) / 2;

  if (Math.abs(sourceY - targetY) < 1) {
    return [{ x1: sourceX, y1: sourceY, x2: targetX, y2: targetY }];
  }

  return [
    { x1: sourceX, y1: sourceY, x2: midX, y2: sourceY },
    { x1: midX, y1: sourceY, x2: midX, y2: targetY },
    { x1: midX, y1: targetY, x2: targetX, y2: targetY },
  ];
}

/** TB variant: connectors run from bottom of source to top of target. */
function computeEdgeLinesTB(
  fromNode: LayoutPipelineNode,
  toNode: LayoutPipelineNode,
): EdgeLine[] {
  const sourceX = fromNode.x + fromNode.width / 2;
  const sourceY = fromNode.y + fromNode.height;
  const targetX = toNode.x + toNode.width / 2;
  const targetY = toNode.y;
  const midY = (sourceY + targetY) / 2;

  if (Math.abs(sourceX - targetX) < 1) {
    return [{ x1: sourceX, y1: sourceY, x2: targetX, y2: targetY }];
  }

  return [
    { x1: sourceX, y1: sourceY, x2: sourceX, y2: midY },
    { x1: sourceX, y1: midY, x2: targetX, y2: midY },
    { x1: targetX, y1: midY, x2: targetX, y2: targetY },
  ];
}

export interface ComputeLayoutOptions {
  direction?: 'LR' | 'TB';
  /** Fallback dimensions when a node provides none (used for the setup root, etc.) */
  defaultWidth: number;
  defaultHeight: number;
  /** Override per-node dimensions; falls back to defaults when undefined */
  nodeSize?: (
    node: PipelineNode<unknown>,
  ) => { width: number; height: number } | undefined;
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

/**
 * Run dagre layout to compute positions for all pipeline nodes and edges.
 * `requiresApproval` flows from the node's parent metadata onto each edge.
 */
export function computePipelineLayout<T>(
  pipelineNodes: PipelineNode<T>[],
  options: ComputeLayoutOptions,
): PipelineLayout<T> {
  const {
    direction = 'LR',
    defaultWidth,
    defaultHeight,
    nodeSize,
    nodesep = 30,
    ranksep = 80,
    marginx = 20,
    marginy = 20,
  } = options;

  if (pipelineNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const sizeOf = (node: PipelineNode<T>) =>
    nodeSize?.(node as PipelineNode<unknown>) ?? {
      width: defaultWidth,
      height: defaultHeight,
    };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ nodesep, rankdir: direction, ranksep, marginx, marginy });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of pipelineNodes) {
    const { width, height } = sizeOf(node);
    graph.setNode(node.id, { width, height });
  }

  // Track requiresApproval per edge from node parent metadata.
  const approvalByEdge = new Map<string, boolean | undefined>();
  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  for (const node of pipelineNodes) {
    for (const parent of node.parents) {
      graph.setEdge(parent.id, node.id);
      approvalByEdge.set(edgeKey(parent.id, node.id), parent.requiresApproval);
    }
  }

  dagre.layout(graph);

  const nodeMap = new Map<string, PipelineNode<T>>();
  for (const node of pipelineNodes) nodeMap.set(node.id, node);

  const layoutNodes: LayoutPipelineNode<T>[] = [];
  const layoutNodeMap = new Map<string, LayoutPipelineNode<T>>();

  for (const nodeId of graph.nodes()) {
    const gNode = graph.node(nodeId);
    const pNode = nodeMap.get(nodeId);
    if (!gNode || !pNode) continue;
    const { width, height } = sizeOf(pNode);
    const layoutNode: LayoutPipelineNode<T> = {
      ...pNode,
      x: gNode.x - width / 2,
      y: gNode.y - height / 2,
      width,
      height,
    };
    layoutNodes.push(layoutNode);
    layoutNodeMap.set(nodeId, layoutNode);
  }

  const computeLines =
    direction === 'TB' ? computeEdgeLinesTB : computeEdgeLines;

  const edges: PipelineEdge[] = [];
  for (const edgeInfo of graph.edges()) {
    const fromNode = layoutNodeMap.get(edgeInfo.v);
    const toNode = layoutNodeMap.get(edgeInfo.w);
    if (!fromNode || !toNode) continue;

    edges.push({
      from: edgeInfo.v,
      to: edgeInfo.w,
      lines: computeLines(fromNode, toNode),
      requiresApproval: approvalByEdge.get(edgeKey(edgeInfo.v, edgeInfo.w)),
    });
  }

  let maxX = 0;
  let maxY = 0;
  for (const node of layoutNodes) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return { nodes: layoutNodes, edges, width: maxX, height: maxY };
}
