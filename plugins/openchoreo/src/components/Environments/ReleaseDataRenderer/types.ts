export type HealthStatus =
  | 'Unknown'
  | 'Progressing'
  | 'Healthy'
  | 'Suspended'
  | 'Degraded';

export interface ResourceTreeParentRef {
  group?: string;
  version: string;
  kind: string;
  namespace: string;
  name: string;
  uid: string;
}

export interface ResourceTreeNode {
  group?: string;
  version: string;
  kind: string;
  namespace: string;
  name: string;
  uid: string;
  resourceVersion: string;
  createdAt: string;
  object: Record<string, unknown>;
  health: { status: HealthStatus };
  parentRefs?: ResourceTreeParentRef[];
}

export interface ReleaseTreeRelease {
  name: string;
  targetPlane: string;
  nodes: ResourceTreeNode[];
  renderedRelease?: Record<string, unknown>; // Full RenderedRelease CR from enriched tree response
}

export interface ResourceTreeData {
  renderedReleases?: ReleaseTreeRelease[];
}
