import {
  AuthorizeResult,
  isResourcePermission,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { LoggerService } from '@backstage/backend-plugin-api';
import { getUserTokenFromContext } from '@openchoreo/openchoreo-auth';
import {
  OPENCHOREO_PERMISSION_TO_ACTION,
  OPENCHOREO_RESOURCE_TYPE_COMPONENT,
} from '@openchoreo/backstage-plugin-common';
import { AuthzProfileService } from '../services';
import {
  openchoreoConditions,
  createOpenChoreoConditionalDecision,
} from '../rules';

/** Permission name prefix for OpenChoreo permissions */
const PERMISSION_PREFIX = 'openchoreo.';

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
 * - Only handles permissions prefixed with 'openchoreo.' (composable)
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
   * For non-OpenChoreo permissions, returns ALLOW to defer to other policies.
   */
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const { permission } = request;

    // Only handle OpenChoreo permissions
    if (!permission.name.startsWith(PERMISSION_PREFIX)) {
      // Defer to other policies by allowing
      return { result: AuthorizeResult.ALLOW };
    }

    // Must have a user for OpenChoreo permissions
    if (!user) {
      this.logger.debug(`Denying ${permission.name} - no user context`);
      return { result: AuthorizeResult.DENY };
    }

    try {
      // Get the OpenChoreo user token from context
      const userToken = getUserTokenFromContext();

      if (!userToken) {
        this.logger.warn(
          `No OpenChoreo token available for permission check: ${permission.name}`,
        );
        return { result: AuthorizeResult.DENY };
      }

      // Map Backstage permission name to OpenChoreo action
      const action = this.mapPermissionToAction(permission.name);

      if (!action) {
        this.logger.warn(`Unknown OpenChoreo permission: ${permission.name}`);
        return { result: AuthorizeResult.DENY };
      }

      // Fetch global capabilities (scope matching happens in apply-conditions)
      const capabilities = await this.authzService.getCapabilities(userToken);

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
}
