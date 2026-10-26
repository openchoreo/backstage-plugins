import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchema(
  definition: JSONSchema7Definition,
): definition is JSONSchema7 {
  return typeof definition === 'object';
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => isEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Drops the values a form filled in from `schema` defaults: those `original`
 * lacks that still equal their default. Objects are walked key by key, and one
 * that only held such values is dropped. Values `original` has are kept.
 *
 * Only `properties` are walked, since the platform reapplies those defaults
 * when it renders. It doesn't apply defaults inside `oneOf` or `anyOf`
 * branches, so values there are kept as they are.
 */
export function withoutFilledDefaults(
  schema: JSONSchema7,
  value: PlainObject,
  original: PlainObject | undefined,
): PlainObject {
  const properties = schema.properties ?? {};
  const result: PlainObject = {};
  for (const [key, current] of Object.entries(value)) {
    const definition = properties[key];
    const propertySchema =
      definition && isSchema(definition) ? definition : undefined;
    const before = original?.[key];

    if (
      before === undefined &&
      propertySchema?.default !== undefined &&
      isEqual(current, propertySchema.default)
    ) {
      continue;
    }
    if (isPlainObject(current) && propertySchema) {
      const nested = withoutFilledDefaults(
        propertySchema,
        current,
        isPlainObject(before) ? before : undefined,
      );
      if (before !== undefined || Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }
    result[key] = current;
  }
  return result;
}
