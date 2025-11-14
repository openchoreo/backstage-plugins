import { JSONSchema7 } from 'json-schema';

/**
 * Component Type list item - complete metadata returned from list endpoint
 * Now includes all details that were previously only in specific GET endpoint
 * @public
 */
export interface ComponentTypeListItem {
  /**
   * Unique identifier for the component type
   */
  name: string;
  /**
   * Workload type (e.g., 'deployment', 'job', 'statefulset')
   */
  workloadType: string;
  /**
   * Creation timestamp (ISO format)
   */
  createdAt: string;
  /**
   * Human-readable display name (optional, may be inferred from name)
   */
  displayName?: string;
  /**
   * Description of what this component type is for (optional)
   */
  description?: string;
  /**
   * Tags for categorization and filtering (optional)
   */
  tags?: string[];
  /**
   * List of allowed workflow names for OpenChoreo CI
   * If empty or undefined, means no OpenChoreo CI support
   */
  allowedWorkflows?: string[];
}

/**
 * Response from the component type list API
 * GET /api/v1/orgs/{orgName}/component-types
 * @public
 */
export interface ComponentTypeListResponse {
  /**
   * Success status
   */
  success: boolean;
  /**
   * Response data
   */
  data: {
    /**
     * Array of component type list items
     */
    items: ComponentTypeListItem[];
    /**
     * Total count of component types (for pagination)
     */
    totalCount: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per page
     */
    pageSize: number;
  };
}

/**
 * Response from the component type schema API
 * GET /api/v1/orgs/{orgName}/component-types/{componentTypeName}/schema
 * @public
 */
export interface ComponentTypeSchemaResponse {
  /**
   * Success status
   */
  success: boolean;
  /**
   * JSONSchema7 for the component type's input parameters
   */
  data: JSONSchema7;
}

/**
 * Component Type metadata - same as ComponentTypeListItem
 * Kept as alias for backwards compatibility
 * @public
 */
export type ComponentTypeMetadata = ComponentTypeListItem;

/**
 * Component Type specification
 * @public
 */
export interface ComponentTypeSpec {
  /**
   * JSONSchema definition for input parameters
   * Describes the configuration options developers can provide
   */
  inputParametersSchema: JSONSchema7;
}

/**
 * ComponentType - Full component type object
 * Combines metadata from list endpoint (ComponentTypeListItem) + schema from schema endpoint
 *
 * Usage pattern:
 * 1. Call list endpoint → get ComponentTypeListItem[] with all metadata (including allowedWorkflows)
 * 2. Call schema endpoint → get JSONSchema7 for input parameters
 * 3. Combine into ComponentType for template generation
 *
 * Platform Engineers define component types to allow flexible component modeling
 * @public
 */
export interface ComponentType {
  /**
   * Metadata about the component type (from list endpoint)
   */
  metadata: ComponentTypeMetadata;
  /**
   * Specification including parameter schema (from schema endpoint)
   */
  spec: ComponentTypeSpec;
}

// ========== Request Types for API Client ==========

/**
 * Request parameters for listing component types
 * @public
 */
export interface ComponentTypesGetRequest {
  orgName: string;
  page?: number;
  pageSize?: number;
}

/**
 * Request parameters for getting component type schema
 * @public
 */
export interface ComponentTypeSchemaGetRequest {
  orgName: string;
  ctdName: string;
}
