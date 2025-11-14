import { JSONSchema7 } from 'json-schema';

/**
 * Workflow schema response from OpenChoreo API
 */
export interface ModelsWorkflowSchema {
  /**
   * JSONSchema7 definition for workflow parameters
   */
  schema: JSONSchema7;
}

/**
 * API response wrapper for workflow schema
 */
export interface WorkflowSchemaResponse {
  success: boolean;
  data: JSONSchema7;
}
