import { z } from 'zod';
import {
  createPermissionRule,
  createPermissionResourceRef,
} from '@backstage/plugin-permission-node';
import { Entity } from '@backstage/catalog-model';
import {
  OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  CHOREO_ANNOTATIONS,
} from '@openchoreo/backstage-plugin-common';

/**
 * Entity kinds that are namespace-scoped (not project or component level).
 * These should only match namespace-level capability paths, not project/component paths.
 */
const NAMESPACE_SCOPED_KINDS = new Set([
  'componenttype',
  'traittype',
  'workflow',
  'componentworkflow',
  'environment',
  'dataplane',
  'buildplane',
  'observabilityplane',
  'deploymentpipeline',
]);

/**
 * Permission resource reference for OpenChoreo namespace-scoped resources.
 * Used for `ResourcePermission` checks that authorize actions/mutations
 * (deploy, update, delete, etc.) on components and namespace-scoped resource
 * definitions (Dataplane, ComponentType, etc.).
 *
 * @see matchesCapability — the rule that uses this resource ref
 */
export const openchoreoNamespacedResourceRef = createPermissionResourceRef<
  Entity,
  {}
>().with({
  pluginId: 'openchoreo',
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
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
  namespaceOnly?: boolean,
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

  // Namespace-scoped entities: reject paths with project or component segments
  if (namespaceOnly && (parsed.project || parsed.component)) {
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
 * Permission rule that authorizes **actions/mutations** on OpenChoreo resources
 * (e.g., deploy, update, delete a component or namespace-scoped definition).
 *
 * - **Resource type**: `OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE` — used for
 *   `ResourcePermission` checks, NOT catalog entity reads.
 * - **Scope**: Components and namespace-scoped resource definitions (Dataplane,
 *   ComponentType, Environment, etc.).
 * - **Default behavior**: Denies if the entity has no namespace annotation
 *   (strict — unknown entities cannot be acted upon).
 * - **No `toQuery` filtering**: Always evaluates the full entity at apply-time
 *   because mutations target individual resources, not bulk listings.
 *
 * ### How it differs from `matchesCatalogEntityCapability`
 *
 * `matchesCatalogEntityCapability` controls **catalog visibility** — whether a
 * user can see/list entities in the Backstage catalog. It operates on
 * `RESOURCE_TYPE_CATALOG_ENTITY` (Backstage's built-in type), is permissive by
 * default (allows non-OpenChoreo entities), and provides a `toQuery` for
 * DB-level pre-filtering.
 *
 * This rule (`matchesCapability`) controls **what the user can do** to a
 * resource they can already see.
 */
export const matchesCapability = createPermissionRule({
  name: 'MATCHES_CAPABILITY',
  description:
    'Allow if user has OpenChoreo capability for this resource scope',
  resourceRef: openchoreoNamespacedResourceRef,
  paramsSchema,
  apply: (entity: Entity, params: MatchesCapabilityParams) => {
    const { allowedPaths, deniedPaths } = params;

    // Extract scope from entity annotations
    // TODO: need to handle annotation change from org to namespace
    const namespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
    const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const component =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

    // If no namespace annotation, we can't check - deny
    if (!namespace) {
      return false;
    }

    const scope = { namespace, project, component };
    const namespaceOnly = NAMESPACE_SCOPED_KINDS.has(entity.kind.toLowerCase());

    // Check if explicitly denied at this scope
    for (const deniedPath of deniedPaths) {
      if (matchesScope(deniedPath, scope, namespaceOnly)) {
        return false;
      }
    }

    // Check if explicitly allowed at this scope
    for (const allowedPath of allowedPaths) {
      if (matchesScope(allowedPath, scope, namespaceOnly)) {
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
