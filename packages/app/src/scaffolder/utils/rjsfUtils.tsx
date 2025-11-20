import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

/**
 * Recursively generates a UI Schema with sanitized titles for all fields
 * that don't already have a title in the JSON Schema
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
    Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
      // If the property doesn't have a title, add one in the UI schema
      if (propSchema && typeof propSchema === 'object' && !propSchema.title) {
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
        const itemsUiSchema = generateUiSchemaWithTitles(propSchema.items, key);
        if (Object.keys(itemsUiSchema).length > 0) {
          uiSchema[key] = {
            ...uiSchema[key],
            items: itemsUiSchema,
          };
        }
      }
    });
  }

  return uiSchema;
}
