/**
 * Schema extension keys for git-related workflow fields.
 *
 * These are set to `true` on individual properties in the workflow JSON Schema
 * by the OpenChoreo platform. The walker detects them to map semantic keys
 * (repoUrl, branch, commit, etc.) to their dot-delimited paths in the schema.
 */
export const REPOSITORY_EXTENSIONS: Record<string, string> = {
  'x-openchoreo-component-parameter-repository-url': 'repoUrl',
  'x-openchoreo-component-parameter-repository-branch': 'branch',
  'x-openchoreo-component-parameter-repository-commit': 'commit',
  'x-openchoreo-component-parameter-repository-app-path': 'appPath',
  'x-openchoreo-component-parameter-repository-secret-ref': 'secretRef',
};

/** Semantic keys for git-related fields detected from schema extensions. */
export type GitFieldKey = 'repoUrl' | 'branch' | 'commit' | 'appPath' | 'secretRef';

/** Mapping of semantic git field key → dot-delimited path in the parameters object. */
export type GitFieldMapping = Partial<Record<GitFieldKey, string>>;

/** Resolved values of git fields extracted from a build's parameters. */
export type GitFieldValues = Partial<Record<GitFieldKey, string>>;

/**
 * Retrieve a value from a nested object using a dot-delimited path.
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  let current: any = obj;
  for (const part of path.split('.')) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    )
      return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set a value in a nested object at a dot-delimited path, creating
 * intermediate objects as needed.
 */
export function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: any,
): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Recursively walk schema properties looking for repository extension markers.
 * Returns a mapping of semantic key → dot-delimited path.
 *
 * @example
 * walkSchemaForGitFields(schema.properties, '')
 * // => { repoUrl: "repository.url", branch: "repository.revision.branch", commit: "repository.revision.commit" }
 */
export function walkSchemaForGitFields(
  properties: Record<string, any>,
  prefix: string,
): GitFieldMapping {
  const mapping: Record<string, string> = {};

  for (const [propName, propSchema] of Object.entries(properties)) {
    if (!propSchema || typeof propSchema !== 'object') continue;
    const currentPath = prefix ? `${prefix}.${propName}` : propName;

    for (const [ext, key] of Object.entries(REPOSITORY_EXTENSIONS)) {
      if (propSchema[ext] === true) {
        mapping[key] = currentPath;
      }
    }

    if (propSchema.properties) {
      Object.assign(
        mapping,
        walkSchemaForGitFields(propSchema.properties, currentPath),
      );
    }
  }

  return mapping;
}

/**
 * Extract the values of git-related special fields from a build's parameters
 * using the schema-derived field mapping.
 *
 * This is the single source of truth for resolving git field values from
 * workflow run parameters. Use this everywhere a git field value is needed
 * (runs table, run details, etc.) so the derivation logic is centralised.
 */
export function extractGitFieldValues(
  parameters: Record<string, any> | undefined | null,
  mapping: GitFieldMapping,
): GitFieldValues {
  if (!parameters || !mapping) return {};

  const values: GitFieldValues = {};
  for (const [key, path] of Object.entries(mapping)) {
    if (!path) continue;
    const raw = getNestedValue(parameters, path);
    if (raw !== undefined && raw !== null && raw !== '') {
      values[key as GitFieldKey] = String(raw);
    }
  }
  return values;
}
