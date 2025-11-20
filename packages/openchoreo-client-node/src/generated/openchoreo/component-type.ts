/**
 * Component Type type definitions
 * Built from generated OpenAPI types
 */

import { JSONSchema7 } from 'json-schema';
import type { components } from './types';

/**
 * Component Type metadata
 * Extends ComponentTypeResponse to include optional tags field
 */
export type ComponentTypeMetadata =
  components['schemas']['ComponentTypeResponse'] & {
    /**
     * Tags for categorization and filtering (optional)
     */
    tags?: string[];
  };

/**
 * Component Type specification
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
 * Combines metadata from list endpoint (ComponentTypeResponse) + schema from schema endpoint
 *
 * Usage pattern:
 * 1. Call list endpoint → get ComponentTypeResponse[] with all metadata (including allowedWorkflows)
 * 2. Call schema endpoint → get JSONSchema7 for input parameters
 * 3. Combine into ComponentType for template generation
 *
 * Platform Engineers define component types to allow flexible component modeling
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
