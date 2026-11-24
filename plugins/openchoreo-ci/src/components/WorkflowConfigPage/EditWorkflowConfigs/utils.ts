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

const asSchema = (definition: unknown): JSONSchema7 | undefined =>
  isPlainObject(definition) ? (definition as JSONSchema7) : undefined;

/**
 * Removes values that RJSF injected from schema defaults but the user never
 * set, so untouched optional fields are neither shown as changes nor saved.
 *
 * A value is dropped only when it is absent from `initial`, empty
 * ('' / null / undefined / [] / {}), and its schema default is empty or
 * missing. Values present in `initial` are always kept, and so is an explicit
 * empty value that overrides a non-empty schema default (e.g. clearing an
 * array whose default has items). Array items are pruned against the stored
 * item at the same index; items themselves are never removed.
 */
export function pruneUnsetEmptyValues(
  current: unknown,
  initial: unknown,
  schema?: JSONSchema7,
): unknown {
  if (Array.isArray(current)) {
    const itemSchema = asSchema(schema?.items);
    const baseItems = Array.isArray(initial) ? initial : [];
    return current.map((item, index) =>
      pruneUnsetEmptyValues(item, baseItems[index], itemSchema),
    );
  }
  if (!isPlainObject(current)) return current;

  const base = isPlainObject(initial) ? initial : {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    const propertySchema = asSchema(schema?.properties?.[key]);
    const pruned = pruneUnsetEmptyValues(value, base[key], propertySchema);
    const existed = Object.prototype.hasOwnProperty.call(base, key);
    const isInjectedDefault =
      isEmptyValue(pruned) && isEmptyValue(propertySchema?.default);
    if (!existed && (pruned === undefined || isInjectedDefault)) continue;
    result[key] = pruned;
  }

  return result;
}
