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
  /** Allowed paths from user's capabilities (e.g., ['org/*', 'org/project/*']) */
  allowedPaths: z.array(z.string()),
  /** Denied paths from user's capabilities */
  deniedPaths: z.array(z.string()),
});

export type MatchesCapabilityParams = z.infer<typeof paramsSchema>;

/**
 * Parses capability path from backend format.
 *
 * Backend format: "org/{orgName}/project/{projectName}/component/{componentName}"
 * or wildcards like "org/*", "org/{orgName}/project/*", etc.
 *
 * Returns parsed { org, project, component } values.
 */
function parseCapabilityPath(path: string): {
  org?: string;
  project?: string;
  component?: string;
} {
  // Handle global wildcard
  if (path === '*') {
    return { org: '*', project: '*', component: '*' };
  }

  const result: { org?: string; project?: string; component?: string } = {};

  // Parse org/orgName pattern
  const orgMatch = path.match(/^org\/([^/]+)/);
  if (orgMatch) {
    result.org = orgMatch[1];
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
 * - "org/{orgName}/*" - matches all resources in the org
 * - "org/{orgName}/project/{projectName}/*" - matches all resources in the project
 * - "org/{orgName}/project/{projectName}/component/{componentName}" - matches specific component
 */
function matchesScope(
  path: string,
  scope: { org?: string; project?: string; component?: string },
): boolean {
  // Wildcard matches everything
  if (path === '*') {
    return true;
  }

  const parsed = parseCapabilityPath(path);

  // Check organization
  if (parsed.org && parsed.org !== '*' && parsed.org !== scope.org) {
    return false;
  }

  // If org is wildcard or path only specifies org, it matches
  if (parsed.org === '*' || (!parsed.project && !parsed.component)) {
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
 * The rule extracts the scope (org/project/component) from entity
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
    const org = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
    const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const component =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

    // If no org annotation, we can't check - deny
    if (!org) {
      return false;
    }

    const scope = { org, project, component };

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
