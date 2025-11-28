import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

/**
 * Recursively generates a UI Schema with sanitized titles for all fields
 * that don't already have a title in the JSON Schema.
 */
export function generateUiSchemaWithTitles(
  schema: any,
  _parentKey: string = '',
): any {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const uiSchema: any = {};

  // Handle object properties
  if (schema.properties) {
    Object.entries(schema.properties).forEach(
      ([key, propSchema]: [string, any]) => {
        if (!propSchema || typeof propSchema !== 'object') {
          return;
        }

        // If the property doesn't have a title, add one in the UI schema
        if (!propSchema.title) {
          uiSchema[key] = {
            'ui:title': sanitizeLabel(key),
          };
        }

        // Recursively handle nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedUiSchema = generateUiSchemaWithTitles(propSchema, key);
          uiSchema[key] = {
            ...uiSchema[key],
            ...nestedUiSchema,
          };
        }

        // Handle array items
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsUiSchema = generateUiSchemaWithTitles(
            propSchema.items,
            key,
          );
          if (Object.keys(itemsUiSchema).length > 0) {
            uiSchema[key] = {
              ...uiSchema[key],
              items: itemsUiSchema,
            };
          }
        }
      },
    );
  }

  return uiSchema;
}

/**
 * Filters out empty object properties from a JSON Schema.
 *
 * Empty object properties are defined as properties with:
 * - type: 'object'
 * - No 'properties' defined
 * - No 'additionalProperties' defined
 * - No 'enum' or 'const' constraints
 *
 * This is useful for cleaning up schemas before rendering forms, preventing
 * empty sections from appearing in the UI.
 *
 * @param schema - The JSON Schema to filter
 * @returns A new schema object with empty object properties removed
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     emptyObj: { type: 'object' },  // Will be filtered out
 *     settings: {
 *       type: 'object',
 *       properties: { enabled: { type: 'boolean' } }  // Will be kept
 *     }
 *   },
 *   required: ['name', 'emptyObj', 'settings']
 * };
 *
 * const filtered = filterEmptyObjectProperties(schema);
 * // Returns schema without 'emptyObj' property and removes it from required array
 * ```
 */
export function filterEmptyObjectProperties(schema: any): any {
  if (!schema?.properties) {
    return schema;
  }

  const filteredProperties: any = {};

  Object.keys(schema.properties).forEach(key => {
    const prop = schema.properties[key];

    // Keep the property if:
    // 1. It's not an object type, OR
    // 2. It's an object with defined properties/additionalProperties, OR
    // 3. It has other schema constraints (required, enum, etc.)
    if (
      typeof prop === 'object' &&
      prop.type === 'object' &&
      !prop.properties &&
      !prop.additionalProperties &&
      !prop.enum &&
      !prop.const
    ) {
      // Skip empty object properties
      return;
    }

    filteredProperties[key] = prop;
  });

  return {
    ...schema,
    properties: filteredProperties,
    // Update required array to exclude filtered properties
    required: schema.required?.filter((req: string) =>
      filteredProperties.hasOwnProperty(req),
    ),
  };
}
