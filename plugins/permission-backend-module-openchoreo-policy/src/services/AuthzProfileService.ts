import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { AuthzProfileCache } from './AuthzProfileCache';
import type { UserCapabilitiesResponse, OpenChoreoScope } from './types';

// Response type from API
type ProfileResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: UserCapabilitiesResponse;
};

/** Default TTL in milliseconds when token expiration cannot be determined */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Extracts TTL from JWT token expiration claim.
 * Returns the time remaining until the token expires in milliseconds.
 */
function getTtlFromToken(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return DEFAULT_CACHE_TTL_MS;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const exp = payload.exp;
    if (!exp) {
      return DEFAULT_CACHE_TTL_MS;
    }
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = exp - now;
    // Ensure at least 1 second TTL, max the remaining time
    return Math.max(1000, ttlSeconds * 1000);
  } catch {
    return DEFAULT_CACHE_TTL_MS;
  }
}

/**
 * Configuration for AuthzProfileService.
 */
export interface AuthzProfileServiceOptions {
  /** Base URL for the OpenChoreo API */
  baseUrl: string;
  /** Logger service */
  logger: LoggerService;
  /** Optional cache for capabilities */
  cache?: AuthzProfileCache;
}

/**
 * Service for fetching user capabilities from the OpenChoreo /authz/profile API.
 *
 * This service is used by the permission policy to determine what actions
 * a user is allowed to perform on OpenChoreo resources.
 */
export class AuthzProfileService {
  private readonly baseUrl: string;
  private readonly logger: LoggerService;
  private readonly cache?: AuthzProfileCache;

  constructor(options: AuthzProfileServiceOptions) {
    this.baseUrl = options.baseUrl;
    this.logger = options.logger;
    this.cache = options.cache;
  }

  /**
   * Creates an OpenChoreo API client with the given user token.
   */
  private createClient(token: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  /**
   * Fetches user capabilities, optionally filtered by scope.
   *
   * @param userToken - The user's OpenChoreo IDP token
   * @param scope - Optional scope (org, project, component) to filter capabilities
   * @returns The user's capabilities (global if no scope provided)
   */
  async getCapabilities(
    userToken: string,
    scope?: OpenChoreoScope,
  ): Promise<UserCapabilitiesResponse> {
    const org = scope?.org;
    const project = scope?.project;
    const component = scope?.component;

    // Check cache first (use 'global' as key when no org specified)
    const cacheKey = org ?? 'global';
    if (this.cache) {
      const cached = await this.cache.get(
        userToken,
        cacheKey,
        project,
        component,
      );
      if (cached) {
        this.logger.info(
          `Cache hit for capabilities: org=${
            org ?? 'global'
          } project=${project} component=${component}`,
        );
        return cached;
      }
    }

    this.logger.info(
      `Fetching capabilities from API: org=${
        org ?? 'global'
      } project=${project} component=${component}`,
    );

    try {
      const client = this.createClient(userToken);

      // Build query parameters - only include if provided
      const query: {
        org?: string;
        project?: string;
        component?: string;
        ou?: string[];
      } = {};

      if (org) query.org = org;
      if (project) query.project = project;
      if (component) query.component = component;
      if (scope?.orgUnits?.length) query.ou = scope.orgUnits;

      const { data, error, response } = await client.GET('/authz/profile', {
        params: { query },
      });

      if (error || !response.ok) {
        const errorMsg =
          error && typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : `Failed to fetch capabilities: ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
      }

      const profileResponse = data as ProfileResponse;
      const capabilities = profileResponse.data;

      if (!capabilities) {
        throw new Error('No capabilities data in response');
      }

      // Cache the result with TTL derived from token expiration
      if (this.cache) {
        const ttlMs = getTtlFromToken(userToken);
        await this.cache.set(
          userToken,
          cacheKey,
          capabilities,
          ttlMs,
          project,
          component,
        );
      }

      return capabilities;
    } catch (err) {
      this.logger.error(
        `Failed to fetch capabilities for org=${
          org ?? 'global'
        } project=${project} component=${component}: ${err}`,
      );
      throw err;
    }
  }

  /**
   * Checks if a specific action is allowed for the user at the given scope.
   *
   * @param userToken - The user's OpenChoreo IDP token
   * @param action - The action to check (e.g., 'component.create')
   * @param scope - The scope to check the action against
   * @returns True if the action is allowed, false otherwise
   */
  async isActionAllowed(
    userToken: string,
    action: string,
    scope: OpenChoreoScope,
  ): Promise<boolean> {
    try {
      const capabilities = await this.getCapabilities(userToken, scope);
      return this.evaluateAction(capabilities, action, scope);
    } catch (err) {
      this.logger.warn(
        `Error checking action ${action} for scope ${JSON.stringify(
          scope,
        )}: ${err}`,
      );
      return false;
    }
  }

  /**
   * Evaluates whether an action is allowed based on capabilities.
   */
  private evaluateAction(
    capabilities: UserCapabilitiesResponse,
    action: string,
    scope: OpenChoreoScope,
  ): boolean {
    const actionCapability = capabilities.capabilities?.[action];

    if (!actionCapability) {
      this.logger.debug(`No capability found for action: ${action}`);
      return false;
    }

    // Check if explicitly denied at this scope
    if (actionCapability.denied?.length) {
      for (const denied of actionCapability.denied) {
        if (denied.path && this.matchesScope(denied.path, scope)) {
          this.logger.debug(
            `Action ${action} explicitly denied at path ${denied.path}`,
          );
          return false;
        }
      }
    }

    // Check if explicitly allowed at this scope
    if (actionCapability.allowed?.length) {
      for (const allowed of actionCapability.allowed) {
        if (allowed.path && this.matchesScope(allowed.path, scope)) {
          this.logger.debug(`Action ${action} allowed at path ${allowed.path}`);
          return true;
        }
      }
    }

    this.logger.debug(
      `Action ${action} not explicitly allowed for scope ${JSON.stringify(
        scope,
      )}`,
    );
    return false;
  }

  /**
   * Checks if a capability path matches the given scope.
   *
   * Paths can be:
   * - "org/*" - matches all resources in the org
   * - "org/project/*" - matches all resources in the project
   * - "org/project/component" - matches the specific component
   * - "*" - matches everything
   */
  private matchesScope(path: string, scope: OpenChoreoScope): boolean {
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
}
