import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { AuthzProfileCache } from './AuthzProfileCache';
import type { UserCapabilitiesResponse, OpenChoreoScope } from './types';

/** Default TTL in milliseconds when token expiration cannot be determined */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Extracts TTL from JWT token expiration claim.
 * Returns the time remaining until the token expires in milliseconds.
 * Exported for use in pre-caching scenarios.
 */
export function getTtlFromToken(token: string): number {
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
   * @param scope - Optional scope (namespace, project, component) to filter capabilities
   * @returns The user's capabilities (global if no scope provided)
   */
  async getCapabilities(
    userToken: string,
    scope?: OpenChoreoScope,
  ): Promise<UserCapabilitiesResponse> {
    const namespace = scope?.namespace;
    const project = scope?.project;
    const component = scope?.component;

    // Check cache first (use 'global' as key when no namespace specified)
    const cacheKey = namespace ?? 'global';
    if (this.cache) {
      const cached = await this.cache.get(
        userToken,
        cacheKey,
        project,
        component,
      );
      if (cached) {
        this.logger.debug(
          `Cache hit for capabilities: org=${
            namespace ?? 'global'
          } project=${project} component=${component}`,
        );
        return cached;
      }
    }

    this.logger.debug(
      `Fetching capabilities from API: org=${
        namespace ?? 'global'
      } project=${project} component=${component}`,
    );

    const capabilities = await this.getCapabilitiesFromApi(userToken, scope);

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
  }

  private async getCapabilitiesFromApi(
    userToken: string,
    scope?: OpenChoreoScope,
  ): Promise<UserCapabilitiesResponse> {
    const namespace = scope?.namespace;
    const project = scope?.project;
    const component = scope?.component;

    try {
      const client = this.createClient(userToken);

      const query: {
        namespace?: string;
        project?: string;
        component?: string;
      } = {
        namespace: namespace ?? 'default',
      };

      if (project) query.project = project;
      if (component) query.component = component;

      const { data, error, response } = await client.GET(
        '/api/v1/authz/profile',
        {
          params: { query },
        },
      );

      if (error || !response.ok) {
        const errorMsg =
          error && typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : `Failed to fetch capabilities: ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
      }

      const capabilities = data as UserCapabilitiesResponse;

      this.logger.debug(
        `[AUTHZ] Raw profile response: ${JSON.stringify(data, null, 2)}`,
      );
      this.logger.debug(
        `[AUTHZ] Parsed capabilities: ${JSON.stringify(capabilities, null, 2)}`,
      );

      if (!capabilities) {
        throw new Error('No capabilities data in response');
      }

      return capabilities;
    } catch (err) {
      this.logger.error(
        `Failed to fetch capabilities for namespace=${
          namespace ?? 'global'
        } project=${project} component=${component}: ${err}`,
      );
      throw err;
    }
  }

  /**
   * Fetches user capabilities with userEntityRef-based cache lookup.
   * This method is used by the permission policy where the token may not be available
   * (e.g., internal service-to-service calls).
   *
   * Flow:
   * 1. Try to get from cache by userEntityRef
   * 2. If cache miss and token available, fetch from API and cache by userEntityRef
   * 3. If no token and no cache, return empty capabilities (deny all)
   *
   * @param userEntityRef - The user's entity reference (e.g., "user:default/email@example.com")
   * @param userToken - Optional user token (may be undefined for internal calls)
   * @param scope - Optional scope to filter capabilities
   * @returns The user's capabilities
   */
  async getCapabilitiesForUser(
    userEntityRef: string,
    userToken?: string,
    scope?: OpenChoreoScope,
  ): Promise<UserCapabilitiesResponse> {
    const cacheKey = scope?.namespace ?? 'global';

    // Try cache by userEntityRef first (works without token)
    if (this.cache) {
      const cached = await this.cache.getByUser(userEntityRef, cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit by userEntityRef: ${userEntityRef}`);
        this.logger.debug(
          `[CAPABILITIES] For ${userEntityRef}: ${JSON.stringify(
            cached.capabilities,
            null,
            2,
          )}`,
        );
        return cached;
      }
    }

    // If no token, we can't fetch - return empty capabilities (deny all OpenChoreo entities)
    if (!userToken) {
      this.logger.warn(
        `No token and no cached capabilities for ${userEntityRef}`,
      );
      return { capabilities: {} };
    }

    // Fetch from API using existing method (which also caches by token)
    const capabilities = await this.getCapabilities(userToken, scope);

    this.logger.debug(
      `[CAPABILITIES] Fetched for ${userEntityRef}: ${JSON.stringify(
        capabilities.capabilities,
        null,
        2,
      )}`,
    );

    // Also store by userEntityRef for future lookups without token
    if (this.cache) {
      const ttlMs = getTtlFromToken(userToken);
      await this.cache.setByUser(userEntityRef, capabilities, ttlMs, cacheKey);
    }

    return capabilities;
  }

  /**
   * Pre-caches capabilities for a user at sign-in time.
   * This ensures capabilities are available for permission checks
   * even when the token is not available (internal service calls).
   *
   * @param userEntityRef - The user's entity reference
   * @param userToken - The user's OpenChoreo IDP token
   */
  async preCacheCapabilities(
    userEntityRef: string,
    userToken: string,
  ): Promise<void> {
    this.logger.debug(`Pre-caching capabilities for ${userEntityRef}`);

    // Always fetch fresh from the API, bypassing the token-hash cache.
    // This ensures every session refresh picks up capability changes
    // from the OC backend regardless of whether the access token changed.
    const capabilities = await this.getCapabilitiesFromApi(userToken);

    this.logger.debug(
      `[PRE-CACHE] Capabilities for ${userEntityRef}: ${JSON.stringify(
        capabilities.capabilities,
        null,
        2,
      )}`,
    );

    if (this.cache) {
      const ttlMs = getTtlFromToken(userToken);

      // Update token-hash cache so subsequent getCapabilities() calls
      // within this token's lifetime return the fresh data
      await this.cache.set(userToken, 'global', capabilities, ttlMs);

      // Update userEntityRef cache for permission policy lookups
      await this.cache.setByUser(userEntityRef, capabilities, ttlMs, 'global');

      this.logger.debug(
        `Successfully cached capabilities for ${userEntityRef} (TTL: ${ttlMs}ms)`,
      );
    }
  }
}
