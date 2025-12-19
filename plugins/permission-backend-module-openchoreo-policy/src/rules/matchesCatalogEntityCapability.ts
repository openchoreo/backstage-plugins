import { z } from 'zod';
import { Entity } from '@backstage/catalog-model';
import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import {
  makeCreatePermissionRule,
  PermissionRule,
} from '@backstage/plugin-permission-node';
import { PermissionCriteria } from '@backstage/plugin-permission-common';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Type alias for catalog permission rules.
 * These rules work with catalog-entity resource type.
 */
export type CatalogPermissionRule<TParams extends z.ZodTypeAny = z.ZodTypeAny> =
  PermissionRule<
    Entity,
    EntitiesSearchFilter,
    typeof RESOURCE_TYPE_CATALOG_ENTITY,
    z.infer<TParams>
  >;

/**
 * Helper to create catalog permission rules with correct typing.
 */
const createCatalogPermissionRule = makeCreatePermissionRule<
  Entity,
  EntitiesSearchFilter,
  typeof RESOURCE_TYPE_CATALOG_ENTITY
>();

/**
 * Params schema for the matchesCatalogEntityCapability rule.
 */
const paramsSchema = z.object({
  /** The OpenChoreo action to check (e.g., 'component:view') */
  action: z.string(),
  /** Allowed paths from user's capabilities */
  allowedPaths: z.array(z.string()),
  /** Denied paths from user's capabilities */
  deniedPaths: z.array(z.string()),
  /** Entity kinds this rule applies to (e.g., ['Component']) */
  kinds: z.array(z.string()),
});

export type MatchesCatalogEntityCapabilityParams = z.infer<typeof paramsSchema>;

/**
 * Parses capability path from backend format.
 *
 * Backend format: "org/{orgName}/project/{projectName}/component/{componentName}"
 * or wildcards like "org/*", "org/{orgName}/project/*", etc.
 */
function parseCapabilityPath(path: string): {
  org?: string;
  project?: string;
  component?: string;
} {
  if (path === '*') {
    return { org: '*', project: '*', component: '*' };
  }

  const result: { org?: string; project?: string; component?: string } = {};

  const orgMatch = path.match(/^org\/([^/]+)/);
  if (orgMatch) {
    result.org = orgMatch[1];
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
 * Checks if a capability path matches the given scope.
 */
function matchesScope(
  path: string,
  scope: { org?: string; project?: string; component?: string },
): boolean {
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
 * This rule works with catalog-entity resource type and:
 * - First checks if the entity kind matches the allowed kinds
 * - Then extracts scope from OpenChoreo annotations
 * - Finally matches against capability paths
 */
export const matchesCatalogEntityCapability: CatalogPermissionRule<
  typeof paramsSchema
> = createCatalogPermissionRule({
  name: 'MATCHES_CATALOG_ENTITY_CAPABILITY',
  description:
    'Allow if entity kind matches and user has OpenChoreo capability for this resource scope',
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY,
  paramsSchema,
  apply: (entity: Entity, params: MatchesCatalogEntityCapabilityParams) => {
    const { allowedPaths, deniedPaths, kinds } = params;

    // First check if entity kind matches
    const entityKind = entity.kind.toLowerCase();
    const kindMatches = kinds.some(k => k.toLowerCase() === entityKind);

    if (!kindMatches) {
      // Entity kind doesn't match - this rule doesn't apply, allow by default
      // (other rules may still deny)
      return true;
    }

    // Extract scope from entity annotations
    const org = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
    const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const component =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

    // If no org annotation, this isn't an OpenChoreo entity - allow by default
    if (!org) {
      return true;
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
  toQuery: ({
    kinds,
    allowedPaths,
  }): PermissionCriteria<EntitiesSearchFilter> => {
    const kindFilter: EntitiesSearchFilter = {
      key: 'kind',
      values: kinds.map(k => k.toLowerCase()),
    };

    // Filter for entity kinds NOT managed by this rule (User, Group, API, Location, etc.)
    // These are always allowed since the apply() function returns true for non-matching kinds
    const otherKindsFilter: PermissionCriteria<EntitiesSearchFilter> = {
      not: kindFilter,
    };

    // Check for wildcard access (allows all entities of this kind)
    const hasWildcardAccess = allowedPaths.some(
      path => path === '*' || parseCapabilityPath(path).org === '*',
    );

    if (hasWildcardAccess) {
      // User has wildcard access - allow all entities (managed kinds + other kinds)
      return {
        anyOf: [kindFilter, otherKindsFilter] as [
          PermissionCriteria<EntitiesSearchFilter>,
          ...PermissionCriteria<EntitiesSearchFilter>[],
        ],
      };
    }

    // Filter for non-OpenChoreo entities (those without org annotation)
    const noOrgAnnotationFilter: EntitiesSearchFilter = {
      key: `metadata.annotations.${CHOREO_ANNOTATIONS.ORGANIZATION}`,
    };

    // Build filters for each allowed path
    const allowedFilters: PermissionCriteria<EntitiesSearchFilter>[] =
      allowedPaths.map(path => {
        const parsed = parseCapabilityPath(path);
        const conditions: PermissionCriteria<EntitiesSearchFilter>[] = [
          kindFilter,
        ];

        // Add org filter if specific (not wildcard)
        if (parsed.org && parsed.org !== '*') {
          conditions.push({
            key: `metadata.annotations.${CHOREO_ANNOTATIONS.ORGANIZATION}`,
            values: [parsed.org],
          });
        }

        // Add project filter if specific
        if (parsed.project && parsed.project !== '*') {
          conditions.push({
            key: `metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`,
            values: [parsed.project],
          });
        }

        // Add component filter if specific
        if (parsed.component && parsed.component !== '*') {
          conditions.push({
            key: `metadata.annotations.${CHOREO_ANNOTATIONS.COMPONENT}`,
            values: [parsed.component],
          });
        }

        if (conditions.length === 1) {
          return conditions[0];
        }
        return {
          allOf: conditions as [
            PermissionCriteria<EntitiesSearchFilter>,
            ...PermissionCriteria<EntitiesSearchFilter>[],
          ],
        };
      });

    // Also allow non-OpenChoreo entities (those without org annotation)
    const nonOpenchoreoFilter: PermissionCriteria<EntitiesSearchFilter> = {
      allOf: [kindFilter, { not: noOrgAnnotationFilter }] as [
        PermissionCriteria<EntitiesSearchFilter>,
        ...PermissionCriteria<EntitiesSearchFilter>[],
      ],
    };

    // If no allowed paths, return other kinds + non-OpenChoreo managed kinds
    if (allowedFilters.length === 0) {
      return {
        anyOf: [otherKindsFilter, nonOpenchoreoFilter] as [
          PermissionCriteria<EntitiesSearchFilter>,
          ...PermissionCriteria<EntitiesSearchFilter>[],
        ],
      };
    }

    // Combine: (otherKinds OR allowedPath1 OR allowedPath2 OR ... OR non-OpenChoreo)
    const allFilters = [
      otherKindsFilter,
      ...allowedFilters,
      nonOpenchoreoFilter,
    ];
    return {
      anyOf: allFilters as [
        PermissionCriteria<EntitiesSearchFilter>,
        ...PermissionCriteria<EntitiesSearchFilter>[],
      ],
    };
  },
});
