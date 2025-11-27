import { JSONSchema7 } from 'json-schema';

/**
 * Utility functions for environment overrides calculations.
 */

/**
 * Check if object has any keys/values
 */
export function hasData(data: Record<string, unknown> | undefined): boolean {
  return data !== undefined && Object.keys(data).length > 0;
}

/**
 * Check if a schema field is a primitive type that truly requires user input.
 * Object types with nested properties can often be satisfied by nested defaults.
 */
function isPrimitiveRequiredField(schema: JSONSchema7 | undefined): boolean {
  if (!schema) return false;

  // If it has a default, it's not truly required
  if (schema.default !== undefined) {
    return false;
  }

  // If it has properties, it's an object - not a primitive
  if (schema.properties) {
    return false;
  }

  // Check explicit type
  const schemaType = schema.type;
  if (Array.isArray(schemaType)) {
    // Union type - check if any are primitive without being object
    return schemaType.some(t => t !== 'object' && t !== 'array');
  }

  // Primitive types that need user input
  return (
    schemaType === 'string' ||
    schemaType === 'number' ||
    schemaType === 'integer' ||
    schemaType === 'boolean'
  );
}

/**
 * Extract missing required fields from a JSON schema.
 * Only returns primitive fields (string, number, boolean) that are truly required
 * and have no default value. Object types with nested properties are skipped
 * as they can often be satisfied by nested defaults.
 *
 * @param schema - JSON schema with required fields
 * @param data - Current override values
 * @returns Array of field names that are required primitives without defaults or values
 */
export function getMissingRequiredFields(
  schema: JSONSchema7 | null | undefined,
  data: Record<string, unknown> | undefined,
): string[] {
  if (!schema || !schema.required || !Array.isArray(schema.required)) {
    return [];
  }

  const requiredFields = schema.required as string[];
  const currentData = data || {};
  const schemaProperties = (schema.properties || {}) as Record<
    string,
    JSONSchema7
  >;

  return requiredFields.filter(field => {
    // Check if field has a value in the current data
    const value = currentData[field];
    if (value !== undefined && value !== null && value !== '') {
      return false; // Field has a value, not missing
    }

    // Only consider primitive fields as truly requiring user input
    // Object types with nested properties can usually satisfy themselves via nested defaults
    const fieldSchema = schemaProperties[field];
    if (!isPrimitiveRequiredField(fieldSchema)) {
      return false; // Not a primitive field, skip
    }

    // Field is a required primitive with no value and no default
    return true;
  });
}

/**
 * Check if any trait has overrides
 */
export function hasAnyTraitOverrides(
  traitMap: Record<string, Record<string, unknown>>,
): boolean {
  return Object.values(traitMap).some(data => Object.keys(data).length > 0);
}

/**
 * Check if workload has overrides
 */
export function hasWorkloadOverridesData(
  workloadData: Record<string, unknown> | undefined,
): boolean {
  return workloadData !== undefined && Object.keys(workloadData).length > 0;
}

/**
 * Calculate if there are any overrides (component, trait, or workload)
 */
export function calculateHasOverrides(
  componentData: Record<string, unknown>,
  traitMap: Record<string, Record<string, unknown>>,
  workloadData: Record<string, unknown>,
): {
  hasComponentOverrides: boolean;
  hasTraitOverrides: boolean;
  hasWorkloadOverrides: boolean;
  hasAny: boolean;
} {
  const hasComponentOverrides = hasData(componentData);
  const hasTraitOverrides = hasAnyTraitOverrides(traitMap);
  const hasWorkloadOverrides = hasWorkloadOverridesData(workloadData);
  return {
    hasComponentOverrides,
    hasTraitOverrides,
    hasWorkloadOverrides: hasWorkloadOverrides,
    hasAny: hasComponentOverrides || hasTraitOverrides || hasWorkloadOverrides,
  };
}
