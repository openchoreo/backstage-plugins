import {
  AuthorizeResult,
  isResourcePermission,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
  createConditionFactory,
} from '@backstage/plugin-permission-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';
import { getUserTokenFromContext } from '@openchoreo/openchoreo-auth';
import {
  OPENCHOREO_PERMISSION_TO_ACTION,
  OPENCHOREO_RESOURCE_TYPE_COMPONENT,
  CATALOG_KIND_TO_ACTION,
  OPENCHOREO_MANAGED_ENTITY_KINDS,
} from '@openchoreo/backstage-plugin-common';
import { AuthzProfileService } from '../services';
import {
  openchoreoConditions,
  createOpenChoreoConditionalDecision,
  matchesCatalogEntityCapability,
} from '../rules';

/** Permission name prefix for OpenChoreo permissions */
const PERMISSION_PREFIX = 'openchoreo.';

/** Permission name prefix for catalog entity permissions */
const CATALOG_PERMISSION_PREFIX = 'catalog.entity.';

/** Condition factory for catalog entity capability rule */
const catalogConditions = {
  matchesCatalogEntityCapability: createConditionFactory(
    matchesCatalogEntityCapability,
  ),
};

/**
 * Options for the OpenChoreoPermissionPolicy.
 */
export interface OpenChoreoPermissionPolicyOptions {
  /** Service for fetching user capabilities */
  authzService: AuthzProfileService;
  /** Logger service */
  logger: LoggerService;
}

/**
 * OpenChoreo permission policy for Backstage.
 *
 * This policy integrates with the OpenChoreo /authz/profile API to evaluate
 * permissions based on the user's capabilities in OpenChoreo.
 *
 * Key features:
 * - Handles permissions prefixed with 'openchoreo.' (composable)
 * - Handles 'catalog.entity.*' permissions for OpenChoreo-managed entities
 * - Returns CONDITIONAL for resource permissions, with capability patterns
 *   matched against entity scope at apply-conditions time
 * - Caches capabilities per request for efficiency
 * - Maps Backstage permissions to OpenChoreo actions
 *
 * @example
 * ```typescript
 * // In backend index.ts
 * backend.add(import('@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy'));
 * ```
 */
export class OpenChoreoPermissionPolicy implements PermissionPolicy {
  private readonly authzService: AuthzProfileService;
  private readonly logger: LoggerService;

  constructor(options: OpenChoreoPermissionPolicyOptions) {
    this.authzService = options.authzService;
    this.logger = options.logger;
  }

  /**
   * Handles a permission request.
   *
   * For OpenChoreo resource permissions (e.g., component-level):
   * - Returns CONDITIONAL with capability patterns for entity-level checks
   * - The apply-conditions handler will match patterns against entity scope
   *
   * For OpenChoreo basic permissions (org-level):
   * - Returns ALLOW/DENY based on profile capabilities
   *
   * For catalog.entity.* permissions on OpenChoreo-managed entities:
   * - Returns CONDITIONAL to check against OpenChoreo capabilities
   *
   * For non-OpenChoreo permissions, returns ALLOW to defer to other policies.
   */
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const { permission } = request;

    this.logger.debug(`[POLICY_HANDLE] Permission: ${permission.name}`);

    // Handle catalog.entity.* permissions for OpenChoreo-managed entities
    if (permission.name.startsWith(CATALOG_PERMISSION_PREFIX)) {
      this.logger.debug(`[POLICY_HANDLE] Routing to handleCatalogPermission`);
      return this.handleCatalogPermission(request, user);
    }

    // Only handle OpenChoreo permissions
    if (!permission.name.startsWith(PERMISSION_PREFIX)) {
      // Defer to other policies by allowing
      return { result: AuthorizeResult.ALLOW };
    }

    // Must have a user with userEntityRef for OpenChoreo permissions
    const userEntityRef = user?.info?.userEntityRef;
    if (!userEntityRef) {
      this.logger.debug(`Denying ${permission.name} - no user context`);
      return { result: AuthorizeResult.DENY };
    }

    try {
      // Get the OpenChoreo user token from context (may be undefined for internal calls)
      const userToken = getUserTokenFromContext();

      // Map Backstage permission name to OpenChoreo action
      const action = this.mapPermissionToAction(permission.name);

      if (!action) {
        this.logger.warn(`Unknown OpenChoreo permission: ${permission.name}`);
        return { result: AuthorizeResult.DENY };
      }

      // Fetch global capabilities using userEntityRef-based lookup
      // This works even when token is not available (uses cached capabilities)
      const capabilities = await this.authzService.getCapabilitiesForUser(
        userEntityRef,
        userToken,
      );

      // For resource-based permissions (component-level), return CONDITIONAL
      // The apply-conditions handler will check capabilities against entity scope
      if (
        isResourcePermission(permission, OPENCHOREO_RESOURCE_TYPE_COMPONENT)
      ) {
        const actionCapability = capabilities.capabilities?.[action];

        // Extract paths from capability (Backstage rule params only support primitives)
        const allowedPaths =
          actionCapability?.allowed
            ?.map(a => a.path)
            .filter((p): p is string => !!p) ?? [];
        const deniedPaths =
          actionCapability?.denied
            ?.map(d => d.path)
            .filter((p): p is string => !!p) ?? [];

        this.logger.debug(
          `Returning CONDITIONAL for ${permission.name} (action: ${action})`,
        );

        return createOpenChoreoConditionalDecision(
          permission,
          openchoreoConditions.matchesCapability({
            action,
            allowedPaths,
            deniedPaths,
          }),
        );
      }

      // For basic permissions (non-resource), check if action has any allowed paths
      const actionCapability = capabilities.capabilities?.[action];
      const isAllowed = (actionCapability?.allowed?.length ?? 0) > 0;

      this.logger.debug(`${permission.name}: ${isAllowed ? 'ALLOW' : 'DENY'}`);

      return {
        result: isAllowed ? AuthorizeResult.ALLOW : AuthorizeResult.DENY,
      };
    } catch (error) {
      this.logger.error(
        `Error evaluating permission ${permission.name}`,
        error as Error,
      );
      return { result: AuthorizeResult.DENY };
    }
  }

  /**
   * Maps a Backstage permission name to an OpenChoreo action.
   */
  private mapPermissionToAction(permissionName: string): string | undefined {
    return OPENCHOREO_PERMISSION_TO_ACTION[permissionName];
  }

  /**
   * Handles catalog.entity.* permissions for OpenChoreo-managed entities.
   *
   * Returns CONDITIONAL so that the rule can check:
   * 1. If the entity kind is one we care about (Component, System, Domain)
   * 2. If the entity has OpenChoreo annotations
   * 3. If the user has the required capability for that scope
   *
   * Different entity kinds map to different OpenChoreo resources:
   * - Component → component:* actions
   * - System → project:* actions
   * - Domain → organization:* actions
   */
  private async handleCatalogPermission(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const { permission } = request;

    // Only handle resource-based catalog permissions
    if (!isResourcePermission(permission, RESOURCE_TYPE_CATALOG_ENTITY)) {
      // Non-resource catalog permissions (like create) - defer to other policies
      return { result: AuthorizeResult.ALLOW };
    }

    // Must have a user context with userEntityRef
    const userEntityRef = user?.info?.userEntityRef;
    if (!userEntityRef) {
      this.logger.debug(`Denying ${permission.name} - no user context`);
      return { result: AuthorizeResult.DENY };
    }

    try {
      // Get the OpenChoreo user token from context (may be undefined for internal calls)
      const userToken = getUserTokenFromContext();

      this.logger.debug(
        `[CATALOG_PERMISSION] userEntityRef: ${userEntityRef}, token: ${
          userToken ? 'PRESENT' : 'ABSENT'
        }`,
      );

      // Fetch user capabilities using userEntityRef-based lookup
      // This works even when token is not available (uses cached capabilities)
      const capabilities = await this.authzService.getCapabilitiesForUser(
        userEntityRef,
        userToken,
      );

      // Build kindCapabilities for each managed entity kind
      // Each kind maps to a different OpenChoreo action
      const kindCapabilities: Record<
        string,
        { action: string; allowedPaths: string[]; deniedPaths: string[] }
      > = {};

      for (const kind of OPENCHOREO_MANAGED_ENTITY_KINDS) {
        const kindLower = kind.toLowerCase();
        const kindActions = CATALOG_KIND_TO_ACTION[kindLower];
        const action = kindActions?.[permission.name];

        if (!action) {
          // No action mapping for this permission on this kind
          // The kind will be allowed by default in the rule
          continue;
        }

        const actionCapability = capabilities.capabilities?.[action];

        const allowedPaths =
          actionCapability?.allowed
            ?.map(a => a.path)
            .filter((p): p is string => !!p) ?? [];
        const deniedPaths =
          actionCapability?.denied
            ?.map(d => d.path)
            .filter((p): p is string => !!p) ?? [];

        kindCapabilities[kindLower] = {
          action,
          allowedPaths,
          deniedPaths,
        };

        this.logger.debug(
          `[CATALOG_PERMISSION] ${kind} -> action: ${action}, allowed: ${JSON.stringify(
            allowedPaths,
          )}`,
        );
      }

      // Log the kindCapabilities for debugging
      this.logger.info(
        `[CATALOG_PERMISSION] kindCapabilities for ${userEntityRef}: ${JSON.stringify(
          kindCapabilities,
        )}`,
      );

      // Serialize kindCapabilities to JSON (Backstage rules only support primitives)
      const conditions = catalogConditions.matchesCatalogEntityCapability({
        kindCapabilitiesJson: JSON.stringify(kindCapabilities),
        kinds: OPENCHOREO_MANAGED_ENTITY_KINDS,
      });

      this.logger.debug(
        `[CATALOG_PERMISSION] conditions: ${JSON.stringify(
          conditions,
          null,
          2,
        )}`,
      );

      // Return CONDITIONAL - the rule will check entity kind and scope
      return {
        result: AuthorizeResult.CONDITIONAL,
        pluginId: 'catalog',
        resourceType: RESOURCE_TYPE_CATALOG_ENTITY,
        conditions,
      };
    } catch (error) {
      this.logger.error(
        `Error evaluating catalog permission ${permission.name}`,
        error as Error,
      );
      return { result: AuthorizeResult.DENY };
    }
  }
}
