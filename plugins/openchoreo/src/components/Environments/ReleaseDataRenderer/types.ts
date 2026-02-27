export type HealthStatus =
  | 'Unknown'
  | 'Progressing'
  | 'Healthy'
  | 'Suspended'
  | 'Degraded';

export interface ReleaseResource {
  id: string;
  group?: string;
  version: string;
  kind: string;
  name: string;
  namespace?: string;
  status?: Record<string, unknown>;
  healthStatus?: HealthStatus;
  lastObservedTime?: string;
}

export interface ReleaseCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface SpecResource {
  id: string;
  object: Record<string, unknown>;
}

export interface ReleaseSpec {
  owner?: {
    projectName?: string;
    componentName?: string;
  };
  environmentName?: string;
  resources?: SpecResource[];
  interval?: string;
  progressingInterval?: string;
}

export interface ReleaseStatus {
  resources?: ReleaseResource[];
  conditions?: ReleaseCondition[];
}

export interface ReleaseData {
  data?: {
    spec?: ReleaseSpec;
    status?: ReleaseStatus;
  };
}

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
}

export interface ResourceTreeData {
  releases?: ReleaseTreeRelease[];
}
