import type { Environment } from '../hooks/useEnvironmentData';

/** A single line segment of an edge connector */
export interface EdgeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A node in the pipeline DAG */
export interface PipelineNode {
  /** Unique identifier ('__setup__' for setup node, env name for environments) */
  id: string;
  /** Whether this is the synthetic setup/configure node */
  isSetup: boolean;
  /** IDs of parent nodes (environments that promote TO this one) */
  parentIds: string[];
  /** The environment data (undefined for the setup node) */
  environment?: Environment;
}

/** A pipeline node with computed layout position */
export interface LayoutPipelineNode extends PipelineNode {
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
export interface PipelineLayout {
  nodes: LayoutPipelineNode[];
  edges: PipelineEdge[];
  width: number;
  height: number;
}
