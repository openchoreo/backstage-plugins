import { HealthStatus } from '../types';

/** A node in the resource tree graph */
export interface TreeNode {
  /** Unique identifier for the node */
  id: string;
  /** Kubernetes resource UID */
  uid?: string;
  /** Resource kind (e.g., "Deployment", "Service", "ReleaseBinding") */
  kind: string;
  /** Resource name */
  name: string;
  /** Optional namespace */
  namespace?: string;
  /** API group (e.g., "apps", "batch") */
  group?: string;
  /** API version */
  version?: string;
  /** Health status */
  healthStatus?: HealthStatus;
  /** Whether this is the root node */
  isRoot?: boolean;
  /** Last observed timestamp */
  lastObservedTime?: string;
  /** Raw status object for detail drawer */
  status?: Record<string, unknown>;
  /** Spec object - full K8s resource object */
  specObject?: Record<string, unknown>;
  /** IDs of parent nodes (supports multi-level trees) */
  parentIds: string[];
}

/** Computed layout position for a node after dagre layout */
export interface LayoutNode extends TreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An edge between two nodes, composed of line segments */
export interface TreeEdge {
  from: string;
  to: string;
  lines: EdgeLine[];
}

/** A single line segment of an edge connector */
export interface EdgeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The complete computed tree layout */
export interface TreeLayout {
  nodes: LayoutNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
}

/** View mode for release details page */
export type ReleaseViewMode = 'list' | 'tree';
