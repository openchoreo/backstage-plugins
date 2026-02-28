import type { ModelsCompleteComponent } from './index';

/**
 * Repository information extracted from a component's workflow schema
 */
export interface RepositoryInfo {
  url?: string;
  branch?: string;
  path?: string;
}

/**
 * Extracts repository information from a component's workflow schema.
 *
 * **IMPORTANT:** This function assumes the workflow uses the standard repository schema
 * structure as defined in openchoreo/samples/from-source/web-apps/react-starter/react-web-app.yaml:
 *
 * ```yaml
 * workflow:
 *   name: "react"
 *   schema:
 *     repository:
 *       url: "https://github.com/..."
 *       revision:
 *         branch: "main"
 *       appPath: "/path/to/component"
 * ```
 *
 * **This will break if a different workflow schema structure is passed** that does not
 * follow this convention. Different workflow types (e.g., docker, nodejs) may have
 * different schema structures, but most workflows follow the repository pattern above.
 *
 * @param component - The component response from the OpenChoreo API
 * @returns Repository URL, branch, and path if available in the workflow schema
 */
export function getRepositoryInfo(
  component: ModelsCompleteComponent,
): RepositoryInfo {
  const componentWorkflow = component.componentWorkflow;
  if (!componentWorkflow?.systemParameters?.repository) {
    return {};
  }

  const repository = componentWorkflow.systemParameters.repository;

  return {
    url: repository.url,
    branch: repository.revision?.branch,
    path: repository.appPath,
  };
}

/**
 * Constructs a GitHub/GitLab-style URL to view the component source code at a specific path and branch.
 *
 * **IMPORTANT:** This function relies on `getRepositoryInfo()` and therefore assumes the same
 * workflow schema structure. See `getRepositoryInfo()` documentation for details.
 *
 * @param component - The component response from the OpenChoreo API
 * @returns Full URL to the repository path at the specified branch, or base repository URL if path is not available
 *
 * @example
 * ```typescript
 * const url = getRepositoryUrl(component);
 * // Returns: "https://github.com/org/repo/tree/main/services/api"
 * ```
 */
export function getRepositoryUrl(
  component: ModelsCompleteComponent,
): string | undefined {
  const { url, branch, path } = getRepositoryInfo(component);

  if (!url) {
    return undefined;
  }

  if (!path) {
    return url;
  }

  const separator = url.endsWith('/') ? '' : '/';
  return `${url}${separator}tree/${branch || 'main'}/${path}`;
}

/**
 * Common acronyms and abbreviations that should be displayed in uppercase
 */
const KNOWN_ACRONYMS = new Set([
  'cpu',
  'ai',
  'gpu',
  'ram',
  'api',
  'url',
  'uri',
  'http',
  'https',
  'ftp',
  'ssh',
  'ssl',
  'tls',
  'tcp',
  'udp',
  'ip',
  'dns',
  'html',
  'css',
  'json',
  'xml',
  'yaml',
  'sql',
  'db',
  'id',
  'uuid',
  'jwt',
  'oauth',
  'smtp',
  'imap',
  'pop',
  'csv',
  'pdf',
  'ui',
  'ux',
  'cli',
  'sdk',
  'jvm',
  'npm',
  'ttl',
  'vpc',
  'aws',
  'gcp',
  'iam',
  'cidr',
  'arn',
  'rpc',
  'grpc',
  'rest',
  'cors',
  'csrf',
  'xss',
  'dos',
  'ddos',
  'vm',
  'os',
  'io',
  'ide',
  'gui',
  'ascii',
  'utf',
  'iso',
  'mime',
  'sha',
  'md',
  'aes',
  'rsa',
]);

/**
 * Converts camelCase or snake_case strings to Title Case for display labels
 *
 * This utility is used to generate human-readable labels from schema property keys
 * that are typically written in camelCase or snake_case.
 *
 * @param key - The string to convert (camelCase or snake_case)
 * @returns Title Case version of the string
 *
 * @example
 * ```typescript
 * sanitizeLabel('imagePullPolicy')      // "Image Pull Policy"
 * sanitizeLabel('image_pull_policy')    // "Image Pull Policy"
 * sanitizeLabel('CPU')                  // "CPU" (preserves acronyms)
 * sanitizeLabel('cpu')                  // "CPU" (converts known acronym)
 * sanitizeLabel('httpPort')             // "HTTP Port"
 * sanitizeLabel('maxRetries3')          // "Max Retries 3"
 * sanitizeLabel('apiUrl')               // "API URL"
 * ```
 */
export function sanitizeLabel(key: string): string {
  if (!key) return '';

  // Handle snake_case first
  let result = key.replace(/_/g, ' ');

  // Insert spaces before uppercase letters (for camelCase)
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Insert spaces before numbers
  result = result.replace(/([a-zA-Z])(\d)/g, '$1 $2');

  // Split into words
  const words = result.split(/\s+/);

  // Capitalize each word
  const titleCased = words.map(word => {
    if (!word) return '';

    const lowerWord = word.toLowerCase();

    // Keep all-caps acronyms as-is (e.g., CPU, HTTP, URL)
    if (word.length > 1 && word === word.toUpperCase()) {
      return word;
    }

    // Convert known acronyms to uppercase
    if (KNOWN_ACRONYMS.has(lowerWord)) {
      return word.toUpperCase();
    }

    // Capitalize first letter, lowercase the rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return titleCased.join(' ');
}

/**
 * Parse the WORKFLOW_PARAMETERS annotation into a key-value mapping.
 *
 * The annotation format is a newline-separated list of "key: value" pairs where
 * keys are fixed identifiers (e.g., repoUrl, branch, commit) and values are
 * dot-delimited paths into the workflow schema (e.g., parameters.repository.url).
 *
 * @param annotation - The raw annotation string
 * @returns A mapping of key names to their dot-delimited schema paths
 *
 * @example
 * ```typescript
 * const mapping = parseWorkflowParametersAnnotation(
 *   'repoUrl: parameters.repository.url\nbranch: parameters.repository.revision.branch'
 * );
 * // Returns: { repoUrl: 'parameters.repository.url', branch: 'parameters.repository.revision.branch' }
 * ```
 */
export function parseWorkflowParametersAnnotation(
  annotation: string,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  annotation.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      mapping[trimmed.slice(0, colonIdx).trim()] = trimmed
        .slice(colonIdx + 1)
        .trim();
    }
  });
  return mapping;
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
