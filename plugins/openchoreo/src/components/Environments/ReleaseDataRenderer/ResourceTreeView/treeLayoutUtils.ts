import dagre from '@dagrejs/dagre';
import type {
  ReleaseData,
  ResourceTreeData,
  ResourceTreeNode,
  HealthStatus,
} from '../types';
import type {
  TreeNode,
  LayoutNode,
  TreeEdge,
  EdgeLine,
  TreeLayout,
} from './treeTypes';

export const NODE_WIDTH = 320;
export const NODE_HEIGHT = 64;
const ROOT_NODE_ID = '__release_binding__';

export function getResourceTreeNodes(
  resourceTreeData?: ResourceTreeData | null,
): ResourceTreeNode[] {
  return resourceTreeData?.releases?.flatMap(r => r.nodes) ?? [];
}

/**
 * Aggregate health from child nodes (highest-severity wins):
 * Degraded > Unknown > Suspended > Progressing > Healthy
 */
function aggregateHealth(nodes: ResourceTreeNode[]): HealthStatus {
  let hasUnknown = false;
  let hasSuspended = false;
  let hasProgressing = false;
  for (const node of nodes) {
    const status = node.health?.status;
    if (status === 'Degraded') return 'Degraded';
    if (status === 'Unknown') hasUnknown = true;
    else if (status === 'Suspended') hasSuspended = true;
    else if (status === 'Progressing') hasProgressing = true;
  }
  if (hasUnknown) return 'Unknown';
  if (hasSuspended) return 'Suspended';
  if (hasProgressing) return 'Progressing';
  return 'Healthy';
}

/**
 * Transform API release data and resource tree data into tree nodes.
 * Root node comes from releaseData; child hierarchy from resourceTreeData.
 * When resourceTreeData contains `releases`, intermediate Release nodes are created.
 */
export function buildTreeNodes(
  releaseData: ReleaseData,
  resourceTreeData: ResourceTreeData,
  releaseBindingData?: Record<string, unknown> | null,
): TreeNode[] {
  const data = releaseData?.data;
  if (!data) return [];

  const nodes: TreeNode[] = [];

  // Derive root health from ReleaseBinding status, matching the Deploy page logic
  let rootHealth: TreeNode['healthStatus'] = 'Unknown';
  if (releaseBindingData) {
    // Legacy API: status is a flat string ('Ready', 'NotReady', 'Failed')
    if (typeof releaseBindingData.status === 'string') {
      const flatStatus = releaseBindingData.status;
      if (flatStatus === 'Ready') rootHealth = 'Healthy';
      else if (flatStatus === 'Failed') rootHealth = 'Degraded';
      else if (flatStatus === 'NotReady') rootHealth = 'Progressing';
    } else {
      // New API: derive from status.conditions[type=Ready]
      const bindingStatus = releaseBindingData.status as
        | Record<string, unknown>
        | undefined;
      const bindingConditions = Array.isArray(bindingStatus?.conditions)
        ? bindingStatus.conditions
        : [];
      const readyCondition = bindingConditions.find(
        (c: any) => c.type === 'Ready',
      );
      if (readyCondition) {
        const condStatus = (readyCondition as any).status;
        if (condStatus === 'True') rootHealth = 'Healthy';
        else if (condStatus === 'False') rootHealth = 'Degraded';
        else rootHealth = 'Progressing';
      }
    }
  } else {
    // Fallback to release conditions if no binding data
    const releaseConditions = data.status?.conditions ?? [];
    const readyCondition = releaseConditions.find(c => c.type === 'Ready');
    if (readyCondition) {
      rootHealth = readyCondition.status === 'True' ? 'Healthy' : 'Degraded';
    }
  }

  // Use ReleaseBinding name if available, fallback to component name
  const bindingName =
    (releaseBindingData?.name as string) ??
    ((releaseBindingData?.metadata as Record<string, unknown>)
      ?.name as string) ??
    undefined;
  const rootName =
    bindingName ?? data.spec?.owner?.componentName ?? 'ReleaseBinding';

  nodes.push({
    id: ROOT_NODE_ID,
    kind: 'ReleaseBinding',
    name: rootName,
    isRoot: true,
    healthStatus: rootHealth,
    parentIds: [],
  });

  // Create intermediate Release nodes, then resource nodes per release
  const releases = resourceTreeData?.releases ?? [];
  for (const release of releases) {
    const releaseNodeId = `__release__${release.name}`;

    nodes.push({
      id: releaseNodeId,
      kind: 'Release',
      name: release.name,
      version: release.targetPlane,
      healthStatus: aggregateHealth(release.nodes),
      parentIds: [ROOT_NODE_ID],
    });

    for (const node of release.nodes) {
      const parentIds =
        node.parentRefs && node.parentRefs.length > 0
          ? node.parentRefs.map(ref => ref.uid)
          : [releaseNodeId];

      nodes.push({
        id: node.uid,
        uid: node.uid,
        kind: node.kind,
        name: node.name,
        namespace: node.namespace,
        group: node.group,
        version: node.version,
        healthStatus: node.health?.status,
        lastObservedTime: node.createdAt,
        specObject: node.object,
        parentIds,
      });
    }
  }

  return nodes;
}

/**
 * Compute edge line segments between two positioned nodes.
 * Creates L-shaped connectors (3 segments) or a straight line if at same Y.
 */
function computeEdgeLines(
  fromNode: LayoutNode,
  toNode: LayoutNode,
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
 * Run dagre layout to compute positions for all nodes and edges.
 */
export function computeTreeLayout(treeNodes: TreeNode[]): TreeLayout {
  if (treeNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    nodesep: 25,
    rankdir: 'LR',
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  for (const node of treeNodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges from parentIds
  for (const node of treeNodes) {
    for (const parentId of node.parentIds) {
      graph.setEdge(parentId, node.id);
    }
  }

  // Run layout
  dagre.layout(graph);

  // Build node-by-id lookup for edge computation
  const nodeMap = new Map<string, TreeNode>();
  for (const node of treeNodes) {
    nodeMap.set(node.id, node);
  }

  // Extract positioned nodes (dagre gives center coords, convert to top-left)
  const layoutNodes: LayoutNode[] = [];
  const layoutNodeMap = new Map<string, LayoutNode>();

  for (const nodeId of graph.nodes()) {
    const gNode = graph.node(nodeId);
    const treeNode = nodeMap.get(nodeId);
    if (!gNode || !treeNode) continue;

    const layoutNode: LayoutNode = {
      ...treeNode,
      x: gNode.x - NODE_WIDTH / 2,
      y: gNode.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
    layoutNodes.push(layoutNode);
    layoutNodeMap.set(nodeId, layoutNode);
  }

  // Compute edges
  const edges: TreeEdge[] = [];
  for (const edgeInfo of graph.edges()) {
    const fromNode = layoutNodeMap.get(edgeInfo.v);
    const toNode = layoutNodeMap.get(edgeInfo.w);
    if (!fromNode || !toNode) continue;

    const lines = computeEdgeLines(fromNode, toNode);
    edges.push({ from: edgeInfo.v, to: edgeInfo.w, lines });
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
