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
 * True when `value` is a plain object (not null, not an array).  Used to
 * decide whether a value can be deep-merged or recursed into.
 */
function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * True when `schema.type` permits `type` — either as a bare string or as a
 * member of a `["object", "null"]`-style array (nullable schemas, common in
 * generated CRD / OpenAPI schemas).
 */
function schemaAllowsType(schema: JSONSchema7, type: string): boolean {
  if (schema.type === type) return true;
  return Array.isArray(schema.type) && (schema.type as string[]).includes(type);
}

/**
 * Best-effort flattening of `allOf` composition: merges sub-schema properties
 * and required keys into the parent so the rest of the walk can treat the
 * result as a flat object schema.  `$ref`, `oneOf`, and `anyOf` are out of
 * scope — schemas reaching this module are expected to be $ref-resolved.
 */
function flattenAllOf(schema: JSONSchema7): JSONSchema7 {
  if (!schema.allOf || schema.allOf.length === 0) return schema;
  let merged: JSONSchema7 = { ...schema };
  for (const sub of schema.allOf) {
    if (typeof sub !== 'object') continue;
    const subFlat = flattenAllOf(sub);
    merged = {
      ...merged,
      type: merged.type ?? subFlat.type,
      properties: { ...subFlat.properties, ...merged.properties },
      required: [...(merged.required ?? []), ...(subFlat.required ?? [])],
    };
  }
  return merged;
}

/** Pick the first non-`null` type when the schema declares a type array. */
function primaryType(schema: JSONSchema7): string | undefined {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) {
    return (schema.type as string[]).find(t => t !== 'null');
  }
  return undefined;
}

/**
 * Generate a default object from a JSON Schema by walking its properties and
 * using `default` values where specified, or type-appropriate placeholders.
 * `allOf` branches are folded in so inherited properties get defaults too.
 */
export function generateDefaults(schema: JSONSchema7): Record<string, any> {
  const flat = flattenAllOf(schema);
  if (!schemaAllowsType(flat, 'object') || !flat.properties) {
    return {};
  }

  const result: Record<string, any> = {};

  for (const [key, propDef] of Object.entries(flat.properties)) {
    if (typeof propDef === 'boolean') continue;

    if (propDef.default !== undefined) {
      result[key] = propDef.default;
      continue;
    }

    switch (primaryType(propDef)) {
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
 * Recursively merge form data on top of schema defaults so every required
 * schema property appears in the YAML, even when the user has provided only
 * a partial nested object.  Plain objects deep-merge; arrays are atomic
 * (user data replaces the default empty array).  `undefined` at any depth
 * falls back to the corresponding default.
 */
function deepMergeDefaults(
  defaults: Record<string, any>,
  data: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = { ...defaults };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const defaultValue = result[key];
    if (isPlainObject(defaultValue) && isPlainObject(value)) {
      result[key] = deepMergeDefaults(defaultValue, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Build the data tree that will be serialized to YAML: schema defaults
 * deep-merged with `formData` so every schema property is represented,
 * but user-provided values take precedence at every depth.
 */
export function buildYamlData(
  schema: JSONSchema7 | undefined,
  formData: Record<string, any>,
): Record<string, any> {
  if (!schema) return formData ?? {};
  return deepMergeDefaults(generateDefaults(schema), formData ?? {});
}

/**
 * Format a single enum value for the `# allowed: ...` comment.  Non-string
 * values go through `JSON.stringify` so objects/arrays render legibly;
 * strings containing list separators (`,`, `#`) get quoted so the comment
 * stays unambiguous.
 */
function formatEnumValue(value: unknown): string {
  if (typeof value === 'string') {
    return /[,#"]/.test(value) ? JSON.stringify(value) : value;
  }
  return JSON.stringify(value);
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
  return isPlainObject(value);
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
  const flat = flattenAllOf(schema);
  if (!flat.properties) return;
  const requiredSet = new Set(flat.required ?? []);

  for (const pair of map.items) {
    if (!YAML.isScalar(pair.key) || typeof pair.key.value !== 'string') {
      continue;
    }
    const propSchema = flat.properties[pair.key.value];
    if (!propSchema || typeof propSchema === 'boolean') continue;

    if (YAML.isScalar(pair.value)) {
      const comment = buildPropertyComment(
        propSchema,
        requiredSet.has(pair.key.value),
      );
      if (comment) pair.value.comment = comment;
    } else if (
      YAML.isMap(pair.value) &&
      schemaAllowsType(propSchema, 'object')
    ) {
      annotateMap(pair.value, propSchema);
    } else if (
      YAML.isSeq(pair.value) &&
      schemaAllowsType(propSchema, 'array') &&
      isObjectSchema(propSchema.items)
    ) {
      annotateSeq(pair.value, propSchema.items);
    }
  }
}

/** Recursively annotate items in a YAML sequence against the array item schema. */
function annotateSeq(seq: YAML.YAMLSeq, itemsSchema: JSONSchema7): void {
  for (const item of seq.items) {
    if (YAML.isMap(item) && schemaAllowsType(itemsSchema, 'object')) {
      annotateMap(item, itemsSchema);
    } else if (
      YAML.isSeq(item) &&
      schemaAllowsType(itemsSchema, 'array') &&
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
