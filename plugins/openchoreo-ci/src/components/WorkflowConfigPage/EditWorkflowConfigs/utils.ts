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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0);

/**
 * Drops empty values ('' / null / undefined / [] / {}) that are not present in
 * `initial`. RJSF injects schema defaults into formData on change; without
 * this, untouched optional fields show up as new changes and get persisted.
 * Keys present in `initial` are always kept, so an intentional clear survives.
 */
export function pruneUnsetEmptyValues(
  current: unknown,
  initial: unknown,
): unknown {
  if (!isPlainObject(current)) return current;
  const base = isPlainObject(initial) ? initial : {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    const existed = Object.prototype.hasOwnProperty.call(base, key);
    const pruned = isPlainObject(value)
      ? pruneUnsetEmptyValues(value, base[key])
      : value;
    if (!existed && isEmptyValue(pruned)) continue;
    result[key] = pruned;
  }

  return result;
}
