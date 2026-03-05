// Temporary interface for component resource builder until proper API resource is implemented
/**
 * Component Resource models for OpenChoreo API /apply endpoint
 * Represents the structure of a component resource similar to kubectl apply
 * @public
 */

/**
 * Owner specification for a component
 * @public
 */
export interface ComponentOwner {
  projectName: string;
}

/**
 * Workflow configuration for a component
 * Only present if Choreo CI is selected as the workflow provider
 * The parameters field matches the workflow schema exactly — git source fields,
 * scope fields (projectName, componentName), and developer parameters are all
 * placed at the paths defined by the workflow schema / WORKFLOW_PARAMETERS annotation.
 * @public
 */
export interface ComponentWorkflow {
  /** Reference to Workflow name */
  name: string;
  /** Workflow parameters matching the workflow schema structure exactly */
  parameters?: Record<string, any>;
}

/**
 * Trait (Addon) configuration
 * @public
 */
export interface ComponentTrait {
  /** Kind of the trait: 'Trait' (namespace-scoped) or 'ClusterTrait' (cluster-scoped) */
  kind?: string;
  /** Addon type name */
  name: string;
  /** User-defined instance name for this addon */
  instanceName: string;
  /** Configuration matching the addon's schema */
  parameters: Record<string, any>;
}

/**
 * Component specification
 * @public
 */
export interface ComponentSpec {
  /** Owner of the component */
  owner: ComponentOwner;
  /** Component type reference with kind and name */
  componentType: { kind: string; name: string };
  /** Parameters from the component type (user provided values) */
  parameters: Record<string, any>;
  /** Auto deploy flag - automatically deploy when build succeeds */
  autoDeploy?: boolean;
  /** Workflow configuration (optional - only if Choreo CI is selected) */
  workflow?: ComponentWorkflow;
  /** Traits configuration (optional - only if addons are added) */
  traits?: ComponentTrait[];
}

/**
 * Component metadata
 * @public
 */
export interface ComponentMetadata {
  /** Component name */
  name: string;
  /** Namespace */
  namespace: string;
  /** Annotations for display name and description */
  annotations?: {
    'openchoreo.dev/display-name'?: string;
    'openchoreo.dev/description'?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Component Resource
 * Represents the complete component resource structure for /apply endpoint
 * @public
 */
export interface ComponentResource {
  /** API version */
  apiVersion: string;
  /** Resource kind */
  kind: string;
  /** Component metadata */
  metadata: ComponentMetadata;
  /** Component specification */
  spec: ComponentSpec;
}

/**
 * Workload owner specification
 * @public
 */
export interface WorkloadOwner {
  projectName: string;
  componentName: string;
}

/**
 * Workload container specification
 * @public
 */
export interface WorkloadContainer {
  image?: string;
  env?: Array<{ key: string; value: string }>;
  files?: Array<{ key: string; mountPath: string; value: string }>;
}

/**
 * Workload endpoint specification
 * @public
 */
export interface WorkloadEndpoint {
  type: 'HTTP' | 'REST' | 'GraphQL' | 'Websocket' | 'gRPC' | 'TCP' | 'UDP';
  port: number;
  visibility?: ('project' | 'namespace' | 'internal' | 'external')[];
}

/**
 * Workload specification
 * @public
 */
export interface WorkloadSpec {
  owner: WorkloadOwner;
  container?: WorkloadContainer;
  endpoints?: Record<string, WorkloadEndpoint>;
}

/**
 * Workload Resource
 * Represents the complete workload resource structure for /apply endpoint
 * Used for "deploy from image" flow where the image is pre-built
 * @public
 */
export interface WorkloadResource {
  /** API version */
  apiVersion: string;
  /** Resource kind */
  kind: string;
  /** Workload metadata */
  metadata: {
    name: string;
    namespace: string;
  };
  /** Workload specification */
  spec: WorkloadSpec;
}
