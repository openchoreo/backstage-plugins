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
export function getRepositoryInfo(component: ModelsCompleteComponent): RepositoryInfo {
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
export function getRepositoryUrl(component: ModelsCompleteComponent): string | undefined {
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
