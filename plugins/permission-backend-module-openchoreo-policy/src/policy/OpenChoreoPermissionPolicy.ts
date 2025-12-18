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
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { getUserTokenFromContext } from '@openchoreo/openchoreo-auth';
import {
  OPENCHOREO_PERMISSION_TO_ACTION,
  OPENCHOREO_RESOURCE_TYPE_COMPONENT,
} from '@openchoreo/backstage-plugin-common';
import { AuthzProfileService, OpenChoreoScope } from '../services';
import { extractOrgFromToken } from './scopeExtractor';
import {
  openchoreoConditions,
  createOpenChoreoConditionalDecision,
} from '../rules';

/**
 * Options for the OpenChoreoPermissionPolicy.
 */
export interface OpenChoreoPermissionPolicyOptions {
  /** Service for fetching user capabilities */
  authzService: AuthzProfileService;
  /** OpenChoreo configuration */
  config: Config;
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
 * - Extracts scope from entity annotations or JWT claims
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
  private readonly permissionPrefix: string;
  private readonly defaultOrg?: string;

  constructor(options: OpenChoreoPermissionPolicyOptions) {
    this.authzService = options.authzService;
    this.logger = options.logger;

    const permConfig = options.config.getOptionalConfig('permission');
    this.permissionPrefix =
      permConfig?.getOptionalString('permissionPrefix') ?? 'openchoreo.';
    this.defaultOrg = permConfig?.getOptionalString('defaultOrg');
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
    if (!permission.name.startsWith(this.permissionPrefix)) {
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

      // Determine scope (org from token or default)
      const scope = this.resolveScope(userToken);
      if (!scope) {
        this.logger.debug(
          `Could not resolve scope for ${permission.name}, using default deny`,
        );
        return { result: AuthorizeResult.DENY };
      }

      // For resource-based permissions (component-level), return CONDITIONAL
      // The apply-conditions handler will check capabilities against entity scope
      if (
        isResourcePermission(permission, OPENCHOREO_RESOURCE_TYPE_COMPONENT)
      ) {
        // Fetch capabilities (cached) to pass to the condition
        const capabilities = await this.authzService.getCapabilities(
          userToken,
          scope,
        );
        const actionCapability = capabilities.capabilities?.[action];

        this.logger.debug(
          `Returning CONDITIONAL for ${permission.name} (action: ${action}) ` +
            `with capability patterns`,
        );

        // Extract paths from capability (Backstage rule params only support primitives)
        const allowedPaths =
          actionCapability?.allowed
            ?.map(a => a.path)
            .filter((p): p is string => !!p) ?? [];
        const deniedPaths =
          actionCapability?.denied
            ?.map(d => d.path)
            .filter((p): p is string => !!p) ?? [];

        return createOpenChoreoConditionalDecision(
          permission,
          openchoreoConditions.matchesCapability({
            action,
            allowedPaths,
            deniedPaths,
          }),
        );
      }

      // For basic permissions (org-level), check capabilities directly
      const isAllowed = await this.authzService.isActionAllowed(
        userToken,
        action,
        scope,
      );

      this.logger.debug(
        `Permission ${permission.name} (action: ${action}) for ` +
          `org=${scope.org}: ${isAllowed ? 'ALLOW' : 'DENY'}`,
      );

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
   * Resolves the scope for a permission check.
   *
   * Extracts org from the user's JWT token or falls back to config default.
   * For resource-specific scope resolution, the CONDITIONAL pattern delegates
   * this to the apply-conditions handler which has access to the resourceRef.
   */
  private resolveScope(userToken: string): OpenChoreoScope | undefined {
    // Try to extract org from the user's JWT token
    const tokenOrg = extractOrgFromToken(userToken);
    if (tokenOrg) {
      return { org: tokenOrg };
    }

    // Fall back to configured default org
    if (this.defaultOrg) {
      return { org: this.defaultOrg };
    }

    return undefined;
  }
}
