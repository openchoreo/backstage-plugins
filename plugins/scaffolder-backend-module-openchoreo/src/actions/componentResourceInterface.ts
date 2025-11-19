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
   * Workflow schema configuration
   * Contains nested structure matching the Workflow's schema section
   * @public
   */
  export interface WorkflowSchema {
    [key: string]: any; // Dynamic structure based on workflow schema
  }
  
  /**
   * Workflow configuration for a component
   * Only present if Choreo CI is selected as the workflow provider
   * @public
   */
  export interface ComponentWorkflow {
    /** Reference to Workflow name */
    name: string;
    /** Schema matching the Workflow's schema section */
    schema: WorkflowSchema;
  }
  
  /**
   * Trait (Addon) configuration
   * @public
   */
  export interface ComponentTrait {
    /** Addon type name */
    name: string;
    /** User-defined instance name for this addon */
    instanceName: string;
    /** Configuration matching the addon's schema */
    config: Record<string, any>;
  }
  
  /**
   * Component specification
   * @public
   */
  export interface ComponentSpec {
    /** Owner of the component */
    owner: ComponentOwner;
    /** Component type in format: {workloadType}/{componentTypeName} */
    componentType: string;
    /** Parameters from the component type (user provided values) */
    parameters: Record<string, any>;
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
    /** Organization namespace */
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
