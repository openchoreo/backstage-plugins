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
import { parseCapabilityPath } from '../utils/pathUtils';

/**
 * Entity kinds that are namespace-scoped (not project or component level).
 * These should only match namespace-level capability paths, not project/component paths.
 */
export const NAMESPACE_SCOPED_KINDS = new Set([
  'componenttype',
  'traittype',
  'workflow',
  'componentworkflow',
  'environment',
  'dataplane',
  'workflowplane',
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
 *
 * `allowedJson`/`deniedJson` are JSON-encoded `CapabilityResource[]` arrays —
 * each entry has `path` and may carry `constraints.expressions` (ABAC CEL).
 * We pass the full entries (not just paths) so future visibility-time logic
 * can inspect constraints; today the rule still only matches by path because
 * Backstage requires `apply()` to be synchronous and we cannot call the
 * async /authz/evaluates endpoint from here. Per-environment ABAC gating
 * happens via the env-aware permission hooks + /evaluate-with-context route.
 */
const paramsSchema = z.object({
  /** The OpenChoreo action to check (e.g., 'releasebinding:create') */
  action: z.string(),
  /** JSON-encoded `CapabilityResource[]` for allowed entries */
  allowedJson: z.string(),
  /** JSON-encoded `CapabilityResource[]` for denied entries */
  deniedJson: z.string(),
});

export type MatchesCapabilityParams = z.infer<typeof paramsSchema>;

interface CapabilityEntry {
  path: string;
  constraints?: { expressions?: string[] };
}

function parseEntries(json: string): CapabilityEntry[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    // Drop entries that don't carry a string `path` so the apply-time loops
    // can rely on `entry.path` being defined without an extra runtime guard.
    return parsed.filter(
      (e): e is CapabilityEntry =>
        !!e && typeof e === 'object' && typeof e.path === 'string',
    );
  } catch {
    return [];
  }
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
export function matchesScope(
  path: string,
  scope: { namespace?: string; project?: string; component?: string },
  namespaceOnly?: boolean,
): boolean {
  // Wildcard matches everything
  if (path === '*') {
    return true;
  }

  const parsed = parseCapabilityPath(path);

  // Invalid paths never match
  if (!parsed) {
    return false;
  }

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
    const allowedEntries = parseEntries(params.allowedJson);
    const deniedEntries = parseEntries(params.deniedJson);

    // Extract scope from entity annotations
    // TODO: need to handle annotation change from org to namespace
    const namespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
    // System entities use PROJECT_ID annotation, others use PROJECT
    const project =
      entity.kind.toLowerCase() === 'system'
        ? entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_ID]
        : entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const component =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

    // If no namespace annotation, we can't check - deny
    if (!namespace) {
      return false;
    }

    const scope = { namespace, project, component };
    const namespaceOnly = NAMESPACE_SCOPED_KINDS.has(entity.kind.toLowerCase());

    // Check if explicitly denied at this scope. ABAC-constrained denies only
    // deny *when* their CEL expression is true — we cannot evaluate that here
    // (apply must be synchronous), so they are skipped at visibility-time and
    // enforced at action-time via /evaluate-with-context. Unconstrained denies
    // are absolute and short-circuit.
    for (const entry of deniedEntries) {
      const isAbacGated = (entry.constraints?.expressions?.length ?? 0) > 0;
      if (!isAbacGated && matchesScope(entry.path, scope, namespaceOnly)) {
        return false;
      }
    }

    // Check if explicitly allowed at this scope. We cannot evaluate ABAC CEL
    // here (apply must be synchronous), so a constrained allow soft-permits at
    // visibility/list time. The actual env-scoped action gating happens in
    // the frontend permission hooks via /evaluate-with-context.
    for (const entry of allowedEntries) {
      if (matchesScope(entry.path, scope, namespaceOnly)) {
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
