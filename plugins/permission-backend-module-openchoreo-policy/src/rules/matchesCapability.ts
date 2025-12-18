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
 * Checks if a capability path matches the given scope.
 *
 * Paths can be:
 * - "*" - matches everything
 * - "org/*" - matches all resources in the org
 * - "org/project/*" - matches all resources in the project
 * - "org/project/component" - matches the specific component
 */
function matchesScope(
  path: string,
  scope: { org?: string; project?: string; component?: string },
): boolean {
  // Wildcard matches everything
  if (path === '*') {
    return true;
  }

  const parts = path.split('/');
  const [pathOrg, pathProject, pathComponent] = parts;

  // Check organization
  if (pathOrg !== scope.org && pathOrg !== '*') {
    return false;
  }

  // If path is just "org/*", it matches anything in the org
  if (parts.length === 2 && pathProject === '*') {
    return true;
  }

  // Check project if specified in scope
  if (scope.project) {
    if (parts.length < 2) {
      return true; // Org-level permission covers projects
    }
    if (pathProject !== scope.project && pathProject !== '*') {
      return false;
    }
  }

  // If path is "org/project/*", it matches anything in the project
  if (parts.length === 3 && pathComponent === '*') {
    return true;
  }

  // Check component if specified in scope
  if (scope.component) {
    if (parts.length < 3) {
      return true; // Project-level permission covers components
    }
    if (pathComponent !== scope.component && pathComponent !== '*') {
      return false;
    }
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
