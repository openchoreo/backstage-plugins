import { z } from 'zod';
import { Entity } from '@backstage/catalog-model';
import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import { makeCreatePermissionRule } from '@backstage/plugin-permission-node';
import { PermissionCriteria } from '@backstage/plugin-permission-common';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Helper to create catalog permission rules with correct typing.
 */
const createCatalogPermissionRule = makeCreatePermissionRule<
  Entity,
  EntitiesSearchFilter,
  typeof RESOURCE_TYPE_CATALOG_ENTITY
>();

/**
 * Type for kind-specific capability data.
 * Each managed entity kind (Component, System, Domain) can have different
 * allowed/denied paths based on the corresponding OpenChoreo action.
 */
export interface KindCapability {
  /** The OpenChoreo action for this kind (e.g., 'component:view', 'project:view') */
  action: string;
  /** Allowed paths from user's capabilities for this action */
  allowedPaths: string[];
  /** Denied paths from user's capabilities for this action */
  deniedPaths: string[];
}

export type KindCapabilities = Record<string, KindCapability>;

/**
 * Params schema for the matchesCatalogEntityCapability rule.
 *
 * Note: Backstage permission rules only support primitive types in params.
 * We use JSON serialization for the complex kindCapabilities structure.
 */
const paramsSchema = z.object({
  /**
   * JSON-serialized kind-specific capability mappings.
   * Keys are lowercase entity kinds (e.g., 'component', 'system', 'domain').
   * Values contain the action and paths for that kind.
   */
  kindCapabilitiesJson: z.string(),
  /** Entity kinds this rule applies to (e.g., ['Component', 'System', 'Domain']) */
  kinds: z.array(z.string()),
});

export type MatchesCatalogEntityCapabilityParams = z.infer<typeof paramsSchema>;

/**
 * Parses capability path from backend format.
 *
 * Backend format: "ns/{nsName}/project/{projectName}/component/{componentName}"
 * or wildcards like "ns/*", "ns/{nsName}/project/*", etc.
 */
function parseCapabilityPath(path: string): {
  ns?: string;
  project?: string;
  component?: string;
} {
  if (path === '*') {
    return { ns: '*', project: '*', component: '*' };
  }

  const result: { ns?: string; project?: string; component?: string } = {};

  const nsMatch = path.match(/^ns\/([^/]+)/);
  if (nsMatch) {
    result.ns = nsMatch[1];
  }

  const projectMatch = path.match(/project\/([^/]+)/);
  if (projectMatch) {
    result.project = projectMatch[1];
  }

  const componentMatch = path.match(/component\/([^/]+)/);
  if (componentMatch) {
    result.component = componentMatch[1];
  }

  return result;
}

/**
 * Entity level type for path specificity checking.
 */
type EntityLevel = 'domain' | 'system' | 'component';

/**
 * Checks if a capability path matches the given scope.
 *
 * The entityLevel parameter ensures paths are not more specific than the entity:
 * - Domain: only accepts org-level paths (no project or component)
 * - System: only accepts project-level or broader paths (no component)
 * - Component: accepts any level
 *
 * This prevents component-level paths from granting access to parent entities.
 */
function matchesScope(
  path: string,
  scope: { ns?: string; project?: string; component?: string },
  entityLevel: EntityLevel,
): boolean {
  if (path === '*') {
    return true;
  }

  const parsed = parseCapabilityPath(path);

  // Check path specificity - reject paths more specific than entity level
  // Domain entities: path must NOT have project or component
  if (entityLevel === 'domain') {
    if (parsed.project || parsed.component) {
      return false; // Path is more specific than entity level
    }
  }

  // System entities: path must NOT have component
  if (entityLevel === 'system') {
    if (parsed.component) {
      return false; // Path is more specific than entity level
    }
  }

  // Check namespace
  if (parsed.ns && parsed.ns !== '*' && parsed.ns !== scope.ns) {
    return false;
  }

  // If ns is wildcard or path only specifies ns, it matches
  if (parsed.ns === '*' || (!parsed.project && !parsed.component)) {
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
 * Checks if a path is valid for the given entity level.
 * Used by toQuery to filter out paths that are too specific.
 */
function isPathValidForLevel(path: string, entityLevel: EntityLevel): boolean {
  if (path === '*') {
    return true;
  }

  const parsed = parseCapabilityPath(path);

  if (entityLevel === 'domain') {
    return !parsed.project && !parsed.component;
  }

  if (entityLevel === 'system') {
    return !parsed.component;
  }

  return true; // Component accepts any level
}

/**
 * Permission rule that checks if a user's OpenChoreo capabilities
 * allow a specific action on a catalog entity.
 *
 * This rule works with catalog-entity resource type and:
 * - First checks if the entity kind matches the allowed kinds
 * - Then extracts scope from OpenChoreo annotations
 * - Finally matches against capability paths
 */
export const matchesCatalogEntityCapability = createCatalogPermissionRule({
  name: 'MATCHES_CATALOG_ENTITY_CAPABILITY',
  description:
    'Allow if entity kind matches and user has OpenChoreo capability for this resource scope',
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY,
  paramsSchema,
  apply: (entity: Entity, params: MatchesCatalogEntityCapabilityParams) => {
    const { kindCapabilitiesJson, kinds } = params;

    // Parse the JSON-serialized kindCapabilities
    const kindCapabilities: KindCapabilities = JSON.parse(kindCapabilitiesJson);

    // First check if entity kind matches
    const entityKind = entity.kind.toLowerCase();
    const kindMatches = kinds.some(k => k.toLowerCase() === entityKind);

    if (!kindMatches) {
      // Entity kind doesn't match - this rule doesn't apply, allow by default
      // (other rules may still deny)
      return true;
    }

    // Get the capability config for this entity kind
    const kindCapability = kindCapabilities[entityKind];

    // Extract scope from entity annotations based on entity kind
    // Different entity kinds use different annotations:
    // - Domain: only organization
    // - System: organization + project-id
    // - Component: organization + project + component
    let scope: { ns?: string; project?: string; component?: string };

    if (entityKind === 'domain') {
      // Domain only has organization
      scope = {
        ns: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION],
      };
    } else if (entityKind === 'system') {
      // System has organization and project-id
      scope = {
        ns: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION],
        project: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_ID],
      };
    } else {
      // Component has organization, project, and component
      scope = {
        ns: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION],
        project: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT],
        component: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT],
      };
    }

    // If no namespace annotation, this isn't an OpenChoreo entity - allow by default
    if (!scope.ns) {
      return true;
    }

    // If no capability defined for this kind, deny OpenChoreo entities
    if (!kindCapability) {
      return false;
    }

    const { allowedPaths, deniedPaths } = kindCapability;

    // Determine entity level for path specificity checking
    const entityLevel = entityKind as EntityLevel;

    // Check if explicitly denied at this scope
    for (const deniedPath of deniedPaths) {
      if (matchesScope(deniedPath, scope, entityLevel)) {
        return false;
      }
    }

    // Check if explicitly allowed at this scope
    for (const allowedPath of allowedPaths) {
      if (matchesScope(allowedPath, scope, entityLevel)) {
        return true;
      }
    }

    // Not explicitly allowed
    return false;
  },
  toQuery: ({
    kinds,
    kindCapabilitiesJson,
  }): PermissionCriteria<EntitiesSearchFilter> => {
    // Parse the JSON-serialized kindCapabilities
    const kindCapabilities: KindCapabilities = JSON.parse(kindCapabilitiesJson);
    const managedKindFilter: EntitiesSearchFilter = {
      key: 'kind',
      values: kinds.map(k => k.toLowerCase()),
    };

    // Filter for entity kinds NOT managed by this rule (User, Group, API, Location, etc.)
    // These are always allowed since the apply() function returns true for non-matching kinds
    const otherKindsFilter: PermissionCriteria<EntitiesSearchFilter> = {
      not: managedKindFilter,
    };

    // Filter for non-OpenChoreo entities (those without org annotation)
    const noOrgAnnotationFilter: EntitiesSearchFilter = {
      key: `metadata.annotations.${CHOREO_ANNOTATIONS.ORGANIZATION}`,
    };

    // Build filters for each managed kind
    const kindFilters: PermissionCriteria<EntitiesSearchFilter>[] = [];

    for (const kind of kinds) {
      const kindLower = kind.toLowerCase();
      const capability = kindCapabilities[kindLower];
      const entityLevel = kindLower as EntityLevel;

      const singleKindFilter: EntitiesSearchFilter = {
        key: 'kind',
        values: [kindLower],
      };

      if (!capability) {
        // No capability defined for this kind - only allow non-OpenChoreo entities
        // (those without openchoreo.io/organization annotation)
        kindFilters.push({
          allOf: [singleKindFilter, { not: noOrgAnnotationFilter }] as [
            PermissionCriteria<EntitiesSearchFilter>,
            ...PermissionCriteria<EntitiesSearchFilter>[],
          ],
        });
        continue;
      }

      const { allowedPaths } = capability;

      // Filter paths to only those valid for this entity level
      // e.g., domain only accepts org-level paths, system excludes component-level paths
      const validPaths = allowedPaths.filter(path =>
        isPathValidForLevel(path, entityLevel),
      );

      // If no valid paths after filtering, only allow non-OpenChoreo entities
      if (validPaths.length === 0) {
        kindFilters.push({
          allOf: [singleKindFilter, { not: noOrgAnnotationFilter }] as [
            PermissionCriteria<EntitiesSearchFilter>,
            ...PermissionCriteria<EntitiesSearchFilter>[],
          ],
        });
        continue;
      }

      // Check for wildcard access for this kind (only considering valid paths)
      const hasWildcardAccess = validPaths.some(
        path => path === '*' || parseCapabilityPath(path).ns === '*',
      );

      if (hasWildcardAccess) {
        // User has wildcard access for this kind - allow all entities of this kind
        kindFilters.push(singleKindFilter);
        continue;
      }

      // Non-OpenChoreo entities of this kind (without org annotation) are always allowed
      const nonOpenchoreoOfKind: PermissionCriteria<EntitiesSearchFilter> = {
        allOf: [singleKindFilter, { not: noOrgAnnotationFilter }] as [
          PermissionCriteria<EntitiesSearchFilter>,
          ...PermissionCriteria<EntitiesSearchFilter>[],
        ],
      };
      kindFilters.push(nonOpenchoreoOfKind);

      // Build path-based filters for this kind using appropriate annotations
      for (const path of validPaths) {
        const parsed = parseCapabilityPath(path);
        const conditions: PermissionCriteria<EntitiesSearchFilter>[] = [
          singleKindFilter,
        ];

        // Add namespace filter if specific (not wildcard)
        if (parsed.ns && parsed.ns !== '*') {
          conditions.push({
            key: `metadata.annotations.${CHOREO_ANNOTATIONS.ORGANIZATION}`,
            values: [parsed.ns],
          });
        }

        // Add project filter based on entity kind
        // - System uses PROJECT_ID annotation
        // - Component uses PROJECT annotation
        if (parsed.project && parsed.project !== '*') {
          if (kindLower === 'system') {
            conditions.push({
              key: `metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT_ID}`,
              values: [parsed.project],
            });
          } else if (kindLower === 'component') {
            conditions.push({
              key: `metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`,
              values: [parsed.project],
            });
          }
          // Domain entities don't have project scope
        }

        // Add component filter (only for Component entities)
        if (parsed.component && parsed.component !== '*') {
          if (kindLower === 'component') {
            conditions.push({
              key: `metadata.annotations.${CHOREO_ANNOTATIONS.COMPONENT}`,
              values: [parsed.component],
            });
          }
          // System and Domain don't have component scope
        }

        if (conditions.length === 1) {
          kindFilters.push(conditions[0]);
        } else {
          kindFilters.push({
            allOf: conditions as [
              PermissionCriteria<EntitiesSearchFilter>,
              ...PermissionCriteria<EntitiesSearchFilter>[],
            ],
          });
        }
      }
    }

    // If no kind filters were generated, just return other kinds filter
    if (kindFilters.length === 0) {
      return otherKindsFilter;
    }

    // Combine: (otherKinds OR kindFilter1 OR kindFilter2 OR ...)
    const allFilters = [otherKindsFilter, ...kindFilters];
    return {
      anyOf: allFilters as [
        PermissionCriteria<EntitiesSearchFilter>,
        ...PermissionCriteria<EntitiesSearchFilter>[],
      ],
    };
  },
});
