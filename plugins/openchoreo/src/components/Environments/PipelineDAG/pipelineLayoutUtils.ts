import dagre from '@dagrejs/dagre';
import type { Environment } from '../hooks/useEnvironmentData';
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
// the setup card content is shorter and centers within this space
export const SETUP_NODE_HEIGHT = ENV_NODE_HEIGHT;

/**
 * Build pipeline DAG nodes from environments.
 *
 * Creates a synthetic setup root node. Environments with no incoming
 * promotions (root environments) are connected to the setup node.
 * The `parentIds` for each environment are derived by reversing the
 * `promotionTargets` relationships.
 */
export function buildPipelineNodes(
  environments: Environment[],
): PipelineNode[] {
  // Build a set of all env names and a map of "who promotes TO this env"
  const incomingMap = new Map<string, string[]>();
  for (const env of environments) {
    incomingMap.set(env.name, []);
  }

  // Build a map of promotion target -> requiresApproval for edge metadata
  for (const env of environments) {
    if (env.promotionTargets) {
      for (const target of env.promotionTargets) {
        const incoming = incomingMap.get(target.name);
        if (incoming) {
          incoming.push(env.name);
        }
      }
    }
  }

  const nodes: PipelineNode[] = [];

  // Setup root node
  nodes.push({
    id: SETUP_NODE_ID,
    isSetup: true,
    parentIds: [],
  });

  // Environment nodes
  for (const env of environments) {
    const incoming = incomingMap.get(env.name) ?? [];
    const parentIds =
      incoming.length > 0 ? incoming : [SETUP_NODE_ID];

    nodes.push({
      id: env.name,
      isSetup: false,
      parentIds,
      environment: env,
    });
  }

  return nodes;
}

/**
 * Compute edge line segments between two positioned nodes.
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

  // Same Y level: single horizontal line
  if (Math.abs(sourceY - targetY) < 1) {
    return [{ x1: sourceX, y1: sourceY, x2: targetX, y2: targetY }];
  }

  // L-shaped: 3 segments
  return [
    { x1: sourceX, y1: sourceY, x2: midX, y2: sourceY },
    { x1: midX, y1: sourceY, x2: midX, y2: targetY },
    { x1: midX, y1: targetY, x2: targetX, y2: targetY },
  ];
}

/**
 * Compute edge line segments for top-to-bottom layout.
 * Connectors go from bottom of source to top of target.
 */
function computeEdgeLinesTB(
  fromNode: LayoutPipelineNode,
  toNode: LayoutPipelineNode,
): EdgeLine[] {
  const sourceX = fromNode.x + fromNode.width / 2;
  const sourceY = fromNode.y + fromNode.height;
  const targetX = toNode.x + toNode.width / 2;
  const targetY = toNode.y;
  const midY = (sourceY + targetY) / 2;

  // Same X level: single vertical line
  if (Math.abs(sourceX - targetX) < 1) {
    return [{ x1: sourceX, y1: sourceY, x2: targetX, y2: targetY }];
  }

  // L-shaped: 3 segments
  return [
    { x1: sourceX, y1: sourceY, x2: sourceX, y2: midY },
    { x1: sourceX, y1: midY, x2: targetX, y2: midY },
    { x1: targetX, y1: midY, x2: targetX, y2: targetY },
  ];
}

/**
 * Look up the requiresApproval flag for a promotion edge from source to target.
 */
function getApprovalFlag(
  environments: Environment[],
  fromName: string,
  toName: string,
): boolean {
  const sourceEnv = environments.find(e => e.name === fromName);
  if (!sourceEnv?.promotionTargets) return false;
  const target = sourceEnv.promotionTargets.find(t => t.name === toName);
  return target?.requiresApproval ?? false;
}

/**
 * Run dagre layout to compute positions for all pipeline nodes and edges.
 */
export function computePipelineLayout(
  pipelineNodes: PipelineNode[],
  environments: Environment[],
  direction: 'LR' | 'TB' = 'LR',
): PipelineLayout {
  if (pipelineNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    nodesep: 30,
    rankdir: direction,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  // Add nodes with appropriate dimensions
  for (const node of pipelineNodes) {
    const width = node.isSetup ? SETUP_NODE_WIDTH : ENV_NODE_WIDTH;
    const height = node.isSetup ? SETUP_NODE_HEIGHT : ENV_NODE_HEIGHT;
    graph.setNode(node.id, { width, height });
  }

  // Add edges from parentIds
  for (const node of pipelineNodes) {
    for (const parentId of node.parentIds) {
      graph.setEdge(parentId, node.id);
    }
  }

  // Run layout
  dagre.layout(graph);

  // Build node lookup
  const nodeMap = new Map<string, PipelineNode>();
  for (const node of pipelineNodes) {
    nodeMap.set(node.id, node);
  }

  // Extract positioned nodes (dagre gives center coords, convert to top-left)
  const layoutNodes: LayoutPipelineNode[] = [];
  const layoutNodeMap = new Map<string, LayoutPipelineNode>();

  for (const nodeId of graph.nodes()) {
    const gNode = graph.node(nodeId);
    const pNode = nodeMap.get(nodeId);
    if (!gNode || !pNode) continue;

    const width = pNode.isSetup ? SETUP_NODE_WIDTH : ENV_NODE_WIDTH;
    const height = pNode.isSetup ? SETUP_NODE_HEIGHT : ENV_NODE_HEIGHT;

    const layoutNode: LayoutPipelineNode = {
      ...pNode,
      x: gNode.x - width / 2,
      y: gNode.y - height / 2,
      width,
      height,
    };
    layoutNodes.push(layoutNode);
    layoutNodeMap.set(nodeId, layoutNode);
  }

  // Compute edges with line segments
  const computeLines =
    direction === 'TB' ? computeEdgeLinesTB : computeEdgeLines;

  const edges: PipelineEdge[] = [];
  for (const edgeInfo of graph.edges()) {
    const fromNode = layoutNodeMap.get(edgeInfo.v);
    const toNode = layoutNodeMap.get(edgeInfo.w);
    if (!fromNode || !toNode) continue;

    const lines = computeLines(fromNode, toNode);
    const requiresApproval = getApprovalFlag(
      environments,
      edgeInfo.v,
      edgeInfo.w,
    );

    edges.push({ from: edgeInfo.v, to: edgeInfo.w, lines, requiresApproval });
  }

  // Calculate total graph dimensions
  let maxX = 0;
  let maxY = 0;
  for (const node of layoutNodes) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return {
    nodes: layoutNodes,
    edges,
    width: maxX,
    height: maxY,
  };
}
