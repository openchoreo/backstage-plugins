/** A single line segment of an edge connector */
export interface EdgeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A parent reference with optional edge metadata */
export interface PipelineParent {
  id: string;
  requiresApproval?: boolean;
}

/** A node in the pipeline DAG */
export interface PipelineNode<T = unknown> {
  id: string;
  isSetup: boolean;
  parents: PipelineParent[];
  data?: T;
}

/** A pipeline node with computed layout position */
export interface LayoutPipelineNode<T = unknown> extends PipelineNode<T> {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An edge between two pipeline nodes */
export interface PipelineEdge {
  from: string;
  to: string;
  lines: EdgeLine[];
  requiresApproval?: boolean;
}

/** The complete computed pipeline layout */
export interface PipelineLayout<T = unknown> {
  nodes: LayoutPipelineNode<T>[];
  edges: PipelineEdge[];
  width: number;
  height: number;
}
