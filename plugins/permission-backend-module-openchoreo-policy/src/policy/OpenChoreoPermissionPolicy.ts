import {
  AuthorizeResult,
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
import { OPENCHOREO_PERMISSION_TO_ACTION } from '@openchoreo/backstage-plugin-common';
import { AuthzProfileService, OpenChoreoScope } from '../services';
import { extractOrgFromToken } from './scopeExtractor';

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
   * For OpenChoreo permissions (prefixed with 'openchoreo.'), this method:
   * 1. Extracts the user's OpenChoreo token from the request context
   * 2. Maps the Backstage permission to an OpenChoreo action
   * 3. Resolves the scope (org/project/component)
   * 4. Checks capabilities via the /authz/profile API
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

      // Determine scope (org/project/component)
      const scope = await this.resolveScope(userToken, request, user);
      if (!scope) {
        this.logger.debug(
          `Could not resolve scope for ${permission.name}, using default deny`,
        );
        return { result: AuthorizeResult.DENY };
      }

      // Check capabilities from OpenChoreo
      const isAllowed = await this.authzService.isActionAllowed(
        userToken,
        action,
        scope,
      );

      this.logger.debug(
        `Permission ${permission.name} (action: ${action}) for ` +
          `org=${scope.org} project=${scope.project} component=${scope.component}: ` +
          `${isAllowed ? 'ALLOW' : 'DENY'}`,
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
   * For resource-based permissions, attempts to extract scope from the entity.
   * Falls back to extracting org from the user's JWT token or config default.
   */
  private async resolveScope(
    userToken: string,
    _request: PolicyQuery,
    _user: PolicyQueryUser,
  ): Promise<OpenChoreoScope | undefined> {
    // For now, we can't get the resourceRef from PolicyQuery
    // (that would require CONDITIONAL responses)
    // So we fall back to extracting org from token or default

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
