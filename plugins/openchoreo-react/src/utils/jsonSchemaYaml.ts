/**
 * JSON Schema → annotated YAML helpers.
 *
 * Used by editors that let a user toggle between a structured form and a raw
 * YAML view of the same data.  `buildYamlString` serializes form data into
 * YAML with inline hints (`# required`, `# allowed: ...`) so the YAML view
 * carries the same affordances as the form.  The helpers are framework- and
 * domain-agnostic — they know nothing about traits, workloads, or Backstage.
 */
import { JSONSchema7 } from 'json-schema';
import YAML from 'yaml';

/**
 * Generate a default object from a JSON Schema by walking its properties and
 * using `default` values where specified, or type-appropriate placeholders.
 */
export function generateDefaults(schema: JSONSchema7): Record<string, any> {
  if (schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const result: Record<string, any> = {};

  for (const [key, propDef] of Object.entries(schema.properties)) {
    if (typeof propDef === 'boolean') continue;

    if (propDef.default !== undefined) {
      result[key] = propDef.default;
      continue;
    }

    switch (propDef.type) {
      case 'string':
        result[key] = '';
        break;
      case 'number':
      case 'integer':
        result[key] = 0;
        break;
      case 'boolean':
        result[key] = false;
        break;
      case 'array':
        result[key] = [];
        break;
      case 'object':
        result[key] = generateDefaults(propDef);
        break;
      default:
        result[key] = null;
        break;
    }
  }

  return result;
}

/**
 * Merge schema defaults with form data so every schema property appears in
 * the YAML, but user-provided values take precedence.  Strips `undefined`
 * from form data so cleared fields fall back to defaults instead of
 * overwriting them with `undefined`.
 */
export function buildYamlData(
  schema: JSONSchema7 | undefined,
  formData: Record<string, any>,
): Record<string, any> {
  if (!schema) return formData ?? {};
  const defaults = generateDefaults(schema);
  const cleanData = Object.fromEntries(
    Object.entries(formData ?? {}).filter(([, v]) => v !== undefined),
  );
  return { ...defaults, ...cleanData };
}

/** Format a single enum value for the `# allowed: ...` comment. */
function formatEnumValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Build the inline comment for a property: `required`, `allowed: a, b, c`,
 * or both joined by `; `.  Returns `undefined` when there is nothing to
 * annotate.
 */
function buildPropertyComment(
  propSchema: JSONSchema7,
  isRequired: boolean,
): string | undefined {
  const parts: string[] = [];
  if (isRequired) parts.push('required');
  if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
    parts.push(`allowed: ${propSchema.enum.map(formatEnumValue).join(', ')}`);
  }
  return parts.length > 0 ? ` ${parts.join('; ')}` : undefined;
}

/** True when `items` is a single sub-schema we can recurse into. */
function isObjectSchema(value: unknown): value is JSONSchema7 {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively annotate a YAML map with `# required` / `# allowed: ...`
 * comments based on the matching object schema.  Only scalar leaves are
 * annotated — non-leaf keys are skipped because the user doesn't type a
 * value there, so labelling them as "required" would just be noise.
 * Nested maps and array items are walked so deeply-required leaves are
 * still reached.
 */
function annotateMap(map: YAML.YAMLMap, schema: JSONSchema7): void {
  if (!schema.properties) return;
  const requiredSet = new Set(schema.required ?? []);

  for (const pair of map.items) {
    if (!YAML.isScalar(pair.key) || typeof pair.key.value !== 'string') {
      continue;
    }
    const propSchema = schema.properties[pair.key.value];
    if (!propSchema || typeof propSchema === 'boolean') continue;

    if (YAML.isScalar(pair.value)) {
      const comment = buildPropertyComment(
        propSchema,
        requiredSet.has(pair.key.value),
      );
      if (comment) pair.value.comment = comment;
    } else if (YAML.isMap(pair.value) && propSchema.type === 'object') {
      annotateMap(pair.value, propSchema);
    } else if (
      YAML.isSeq(pair.value) &&
      propSchema.type === 'array' &&
      isObjectSchema(propSchema.items)
    ) {
      annotateSeq(pair.value, propSchema.items);
    }
  }
}

/** Recursively annotate items in a YAML sequence against the array item schema. */
function annotateSeq(seq: YAML.YAMLSeq, itemsSchema: JSONSchema7): void {
  for (const item of seq.items) {
    if (YAML.isMap(item) && itemsSchema.type === 'object') {
      annotateMap(item, itemsSchema);
    } else if (
      YAML.isSeq(item) &&
      itemsSchema.type === 'array' &&
      isObjectSchema(itemsSchema.items)
    ) {
      annotateSeq(item, itemsSchema.items);
    }
  }
}

/**
 * Build a YAML string from form data, annotating required scalar fields with
 * `# required` and enum-constrained scalars with `# allowed: <values>` so the
 * user knows what must be filled in and which values are accepted.  The walk
 * is recursive, so nested objects and array items are covered.
 */
export function buildYamlString(
  schema: JSONSchema7 | undefined,
  formData: Record<string, any>,
): string {
  const data = buildYamlData(schema, formData);
  const doc = new YAML.Document(data);

  if (schema && YAML.isMap(doc.contents)) {
    annotateMap(doc.contents, schema);
  }

  return doc.toString({ indent: 2 });
}
