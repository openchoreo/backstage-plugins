import { z } from 'zod';
import {
  createPermissionRule,
  createPermissionResourceRef,
} from '@backstage/plugin-permission-node';
import { Entity } from '@backstage/catalog-model';
import {
  OPENCHOREO_RESOURCE_TYPE_COMPONENT,
  CHOREO_ANNOTATIONS,
} from '@openchoreo/backstage-plugin-common';

/**
 * Permission resource reference for OpenChoreo component resources.
 * Used for resource-based permission checks on catalog entities.
 */
export const openchoreoComponentResourceRef = createPermissionResourceRef<
  Entity,
  {}
>().with({
  pluginId: 'openchoreo',
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Params schema for the matchesCapability rule.
 * Uses primitive types only (Backstage permission rule constraint).
 */
const paramsSchema = z.object({
  /** The OpenChoreo action to check (e.g., 'component:deploy') */
  action: z.string(),
  /** Allowed paths from user's capabilities (e.g., ['ns/*', 'ns/project/*']) */
  allowedPaths: z.array(z.string()),
  /** Denied paths from user's capabilities */
  deniedPaths: z.array(z.string()),
});

export type MatchesCapabilityParams = z.infer<typeof paramsSchema>;

/**
 * Parses capability path from backend format.
 *
 * Backend format: "ns/{namespaceName}/project/{projectName}/component/{componentName}"
 * or wildcards like "ns/*", "ns/{namespaceName}/project/*", etc.
 *
 * Returns parsed { namespace, project, component } values.
 */
function parseCapabilityPath(path: string): {
  namespace?: string;
  project?: string;
  component?: string;
} {
  // Handle global wildcard
  if (path === '*') {
    return { namespace: '*', project: '*', component: '*' };
  }

  const result: { namespace?: string; project?: string; component?: string } =
    {};

  // Parse namespace/namespaceName pattern
  const namespaceMatch = path.match(/^ns\/([^/]+)/);
  if (namespaceMatch) {
    result.namespace = namespaceMatch[1];
  }

  // Parse project/projectName pattern
  const projectMatch = path.match(/project\/([^/]+)/);
  if (projectMatch) {
    result.project = projectMatch[1];
  }

  // Parse component/componentName pattern
  const componentMatch = path.match(/component\/([^/]+)/);
  if (componentMatch) {
    result.component = componentMatch[1];
  }

  return result;
}

/**
 * Checks if a capability path matches the given scope.
 *
 * Paths from backend are in format:
 * - "*" - matches everything
 * - "ns/{namespaceName}/*" - matches all resources in the namespace
 * - "ns/{namespaceName}/project/{projectName}/*" - matches all resources in the project
 * - "ns/{namespaceName}/project/{projectName}/component/{componentName}" - matches specific component
 */
function matchesScope(
  path: string,
  scope: { namespace?: string; project?: string; component?: string },
): boolean {
  // Wildcard matches everything
  if (path === '*') {
    return true;
  }

  const parsed = parseCapabilityPath(path);

  // Check namespace
  if (
    parsed.namespace &&
    parsed.namespace !== '*' &&
    parsed.namespace !== scope.namespace
  ) {
    return false;
  }

  // If namespace is wildcard or path only specifies namespace, it matches
  if (parsed.namespace === '*' || (!parsed.project && !parsed.component)) {
    return true;
  }

  // Check project
  if (
    parsed.project &&
    parsed.project !== '*' &&
    parsed.project !== scope.project
  ) {
    return false;
  }

  // If project is wildcard or path only specifies up to project, it matches
  if (parsed.project === '*' || !parsed.component) {
    return true;
  }

  // Check component
  if (
    parsed.component &&
    parsed.component !== '*' &&
    parsed.component !== scope.component
  ) {
    return false;
  }

  return true;
}

/**
 * Permission rule that checks if a user's OpenChoreo capabilities
 * allow a specific action on a catalog entity.
 *
 * The rule extracts the scope (namespace/project/component) from entity
 * annotations and matches it against the user's capability patterns.
 */
export const matchesCapability = createPermissionRule({
  name: 'MATCHES_CAPABILITY',
  description:
    'Allow if user has OpenChoreo capability for this resource scope',
  resourceRef: openchoreoComponentResourceRef,
  paramsSchema,
  apply: (entity: Entity, params: MatchesCapabilityParams) => {
    const { allowedPaths, deniedPaths } = params;

    // Extract scope from entity annotations
    // TODO: need to handle annotation change from org to namespace
    const namespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
    const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const component =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

    // If no namespace annotation, we can't check - deny
    if (!namespace) {
      return false;
    }

    const scope = { namespace, project, component };

    // Check if explicitly denied at this scope
    for (const deniedPath of deniedPaths) {
      if (matchesScope(deniedPath, scope)) {
        return false;
      }
    }

    // Check if explicitly allowed at this scope
    for (const allowedPath of allowedPaths) {
      if (matchesScope(allowedPath, scope)) {
        return true;
      }
    }

    // Not explicitly allowed
    return false;
  },
  toQuery: () => {
    // No database filtering - we always need to evaluate against the entity
    return {};
  },
});
