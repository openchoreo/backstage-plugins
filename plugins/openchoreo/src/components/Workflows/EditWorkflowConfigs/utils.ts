import { JSONSchema7 } from 'json-schema';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';
import { Change } from './ChangesPreview';

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

/**
 * Calculates the differences between two objects.
 */
export function calculateChanges(
  initialData: any,
  currentData: any,
): Change[] {
  const changes: Change[] = [];

  const traverse = (obj1: any, obj2: any, path: string = '') => {
    const allKeys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {}),
    ]);

    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (val1 === undefined && val2 !== undefined) {
        changes.push({ path: currentPath, type: 'new', newValue: val2 });
      } else if (val1 !== undefined && val2 === undefined) {
        changes.push({ path: currentPath, type: 'removed', oldValue: val1 });
      } else if (
        typeof val1 === 'object' &&
        val1 !== null &&
        typeof val2 === 'object' &&
        val2 !== null &&
        !Array.isArray(val1) &&
        !Array.isArray(val2)
      ) {
        traverse(val1, val2, currentPath);
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        changes.push({
          path: currentPath,
          type: 'modified',
          oldValue: val1,
          newValue: val2,
        });
      }
    });
  };

  traverse(initialData, currentData);
  return changes;
}
