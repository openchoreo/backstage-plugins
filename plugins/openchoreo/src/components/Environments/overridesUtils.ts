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
 * Collect all required primitive fields from a schema recursively.
 * Used when a parent object is completely empty/missing.
 *
 * @param schema - JSON schema to traverse
 * @param basePath - Current path prefix for dot-notation
 * @returns Array of dot-notation paths to required primitive fields
 */
function collectAllRequiredPrimitives(
  schema: JSONSchema7,
  basePath: string,
): string[] {
  const result: string[] = [];
  const schemaProperties = (schema.properties || {}) as Record<
    string,
    JSONSchema7
  >;

  for (const fieldName of (schema.required as string[]) || []) {
    const fieldPath = `${basePath}.${fieldName}`;
    const fieldSchema = schemaProperties[fieldName];

    // Skip if field has a default
    if (fieldSchema?.default !== undefined) continue;

    if (fieldSchema?.properties) {
      // Nested object - recurse
      result.push(...collectAllRequiredPrimitives(fieldSchema, fieldPath));
    } else {
      // Primitive field
      result.push(fieldPath);
    }
  }

  return result;
}

/**
 * Extract missing required fields from a JSON schema recursively.
 * Traverses nested objects and returns dot-notation paths for all
 * required primitive fields that have no value and no default.
 *
 * @param schema - JSON schema with required fields
 * @param data - Current override values
 * @param path - Current path prefix for dot-notation (internal use)
 * @returns Array of dot-notation paths to missing required fields
 */
export function getMissingRequiredFields(
  schema: JSONSchema7 | null | undefined,
  data: Record<string, unknown> | undefined,
  path: string = '',
): string[] {
  if (!schema || !schema.required || !Array.isArray(schema.required)) {
    return [];
  }

  const missing: string[] = [];
  const currentData = data || {};
  const schemaProperties = (schema.properties || {}) as Record<
    string,
    JSONSchema7
  >;

  for (const fieldName of schema.required as string[]) {
    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
    const fieldSchema = schemaProperties[fieldName];
    const fieldValue = currentData[fieldName];

    // Skip if field has a default
    if (fieldSchema?.default !== undefined) continue;

    // Check if field is missing/empty
    const isMissing =
      fieldValue === undefined || fieldValue === null || fieldValue === '';

    if (fieldSchema?.properties) {
      // Object type - recurse into nested schema
      if (isMissing) {
        // Entire object is missing - collect all nested required primitives
        missing.push(...collectAllRequiredPrimitives(fieldSchema, fieldPath));
      } else {
        // Object has some data - recurse to check nested fields
        missing.push(
          ...getMissingRequiredFields(
            fieldSchema,
            fieldValue as Record<string, unknown>,
            fieldPath,
          ),
        );
      }
    } else {
      // Primitive type
      if (isMissing) {
        missing.push(fieldPath);
      }
    }
  }

  return missing;
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
