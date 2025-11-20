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
  const workflow = component.workflow;
  if (!workflow?.schema) {
    return {};
  }

  // Cast to any since schema is a dynamic object (additionalProperties: true in OpenAPI)
  const schema = workflow.schema as any;
  const repository = schema.repository;

  if (!repository) {
    return {};
  }

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
 * sanitizeLabel('httpPort')             // "Http Port"
 * sanitizeLabel('maxRetries3')          // "Max Retries 3"
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

    // Keep all-caps acronyms as-is (e.g., CPU, HTTP, URL)
    if (word.length > 1 && word === word.toUpperCase()) {
      return word;
    }

    // Capitalize first letter, lowercase the rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return titleCased.join(' ');
}
