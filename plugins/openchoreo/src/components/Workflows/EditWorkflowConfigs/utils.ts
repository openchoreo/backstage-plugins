import { JSONSchema7 } from 'json-schema';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

/**
 * Recursively adds title fields to schema properties if not already defined.
 * Honors existing title fields, otherwise generates from property key.
 */
export function addTitlesToSchema(schema: JSONSchema7): JSONSchema7 {
  if (!schema || typeof schema !== 'object') return schema;

  const result = { ...schema };

  if (result.properties) {
    const newProperties: { [key: string]: JSONSchema7 | boolean } = {};
    for (const [key, value] of Object.entries(result.properties)) {
      if (typeof value === 'boolean') {
        newProperties[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        const prop = { ...value } as JSONSchema7;
        if (!prop.title) {
          prop.title = sanitizeLabel(key);
        }
        newProperties[key] = addTitlesToSchema(prop);
      }
    }
    result.properties = newProperties;
  }

  if (
    result.items &&
    typeof result.items === 'object' &&
    !Array.isArray(result.items)
  ) {
    result.items = addTitlesToSchema(result.items as JSONSchema7);
  }

  return result;
}
