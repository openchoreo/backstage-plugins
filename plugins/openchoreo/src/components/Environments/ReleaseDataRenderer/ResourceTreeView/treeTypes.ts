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
  /** Target plane of a RenderedRelease node (e.g. "dataplane") */
  targetPlane?: string;
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

/**
 * Component/environment context needed to open an exec terminal from a resource
 * node drawer. Resolved once in ReleaseDetailsPage (from entity annotations +
 * the selected environment) and threaded down to the terminal viewer.
 */
export interface ExecContext {
  namespaceName: string;
  projectName: string;
  componentName: string;
  /** Environment identifier used for the exec session and per-env ABAC. */
  environmentName: string;
  /** Human-readable environment label for UI copy. */
  environmentDisplayName: string;
  /**
   * Catalog entity ref of the component. Used as the resourceRef for the exec
   * permission check, and to rebuild an EntityProvider in the standalone
   * full-window terminal (which renders outside the component entity page).
   */
  entityRef: string;
}
