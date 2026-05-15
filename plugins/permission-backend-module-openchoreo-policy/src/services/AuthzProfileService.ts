import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { AuthzProfileCache } from './AuthzProfileCache';
import type { UserCapabilitiesResponse, OpenChoreoScope } from './types';
import { parseCapabilityPath } from '../utils/pathUtils';

type EvaluateRequest = OpenChoreoComponents['schemas']['EvaluateRequest'];
type SubjectContext = OpenChoreoComponents['schemas']['SubjectContext'];

/**
 * Inputs the policy needs to evaluate one capability entry at runtime.
 * `resourcePath` is the capability path matched by the user's profile
 * (e.g., "ns/acme/project/payments/component/api"). `environment` is the
 * runtime attribute used by ABAC CEL expressions like `resource.environment`.
 */
export interface EvaluateInput {
  action: string;
  resourcePath: string;
  environment?: string;
}

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
 * Encodes a dual-scoped resource name into the authz-engine identifier used
 * by ABAC CEL attributes such as `resource.environment`.
 *
 * Mirrors openchoreo's Go `FormatDualScopedResourceName` helper
 * (`internal/openchoreo-api/services/utils.go`,
 *  `internal/observer/authz/helpers.go`) so the value we send for
 * `context.resource.environment` matches the encoding the openchoreo service
 * layer uses everywhere. CEL expressions on `AuthzRoleBinding` conditions
 * are authored against this format — getting it right here is what makes
 * ABAC actually match.
 *
 *   Namespace-scoped resources → `{namespace}/{name}`   (e.g. `team-shop/production`)
 *   Cluster-scoped resources   → plain `{name}`         (e.g. `production`)
 *
 * `Environment` is `scope: Namespaced` today and the only attribute we
 * currently encode, so call sites pass `isClusterScoped: false`. The flag is
 * kept on the signature so the moment OpenChoreo ships a cluster-scoped
 * Environment variant (or any other dual-scoped attribute we want to
 * evaluate against), we flip it at the call site instead of re-discovering
 * the encoding rule.
 *
 * Empty name returns "" so callers can omit the attribute entirely when
 * scope is not provided — matching the observer helper's behavior.
 */
export function formatDualScopedName(
  namespace: string | undefined,
  name: string,
  isClusterScoped: boolean,
): string {
  if (!name) return '';
  if (isClusterScoped || !namespace) return name;
  return `${namespace}/${name}`;
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
      } = {};

      if (namespace) query.namespace = namespace;
      if (project) query.project = project;
      if (component) query.component = component;

      const { data, error, response } = await client.GET(
        '/api/v1/authz/profile',
        {
          params: { query },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch capabilities');

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
   * Evaluates one or more ABAC-gated capability entries via
   * POST /api/v1/authz/evaluates.
   *
   * Returns a boolean for each input in the same order. Results are cached
   * per `(userEntityRef, action, resourcePath, environment)` for the lifetime
   * of the user's JWT (token-derived TTL, 5min fallback) so that a UI rendering
   * the same constrained button repeatedly does not round-trip the backend.
   *
   * The subject context required by the evaluate API is read from the
   * cached profile (`profile.user`) — that is the only authenticated
   * representation of the user available to the policy. When the profile
   * has not been pre-cached and no `userToken` is supplied, evaluation
   * fails closed (returns `false`).
   */
  async evaluate(
    userToken: string | undefined,
    userEntityRef: string,
    inputs: EvaluateInput[],
  ): Promise<boolean[]> {
    if (inputs.length === 0) return [];

    // Pre-encode each input's environment to the form the openchoreo authz
    // layer expects (see `formatDualScopedName`). The same encoded value is
    // used for both the cache key and the outbound /authz/evaluates call so
    // they stay in lockstep — and so two different namespaces with the same
    // env name (e.g. `team-a/dev` vs `team-b/dev`) cannot share a cache slot.
    const encodedEnvs: (string | undefined)[] = inputs.map(input => {
      if (!input.environment) return undefined;
      const parsed = parseCapabilityPath(input.resourcePath);
      const ns =
        parsed?.namespace && parsed.namespace !== '*'
          ? parsed.namespace
          : undefined;
      // Environment is namespace-scoped today; flip `isClusterScoped` here
      // when/if OpenChoreo ships a cluster-scoped variant.
      const encoded = formatDualScopedName(ns, input.environment, false);
      return encoded || undefined;
    });

    // Include a token-derived component in the cache key so that signing out
    // and back in produces a new key and forces a re-evaluation. Without this,
    // a stale `false` from before an authz binding change would survive
    // re-login for the full JWT TTL (up to 24h on our setup), making the only
    // recovery paths "wait" or "restart the backend".
    const tokenHash = userToken
      ? AuthzProfileCache.hashToken(userToken)
      : 'no-token';

    // 1. Cache lookup for every input. Track which need a backend call.
    const results: (boolean | undefined)[] = new Array(inputs.length);
    const missingIdx: number[] = [];
    if (this.cache) {
      for (let i = 0; i < inputs.length; i++) {
        const { action, resourcePath } = inputs[i];
        results[i] = await this.cache.getEvaluation(
          userEntityRef,
          tokenHash,
          action,
          resourcePath,
          encodedEnvs[i],
        );
        if (results[i] === undefined) missingIdx.push(i);
      }
    } else {
      for (let i = 0; i < inputs.length; i++) missingIdx.push(i);
    }

    if (missingIdx.length === 0) {
      return results as boolean[];
    }

    // 2. Need to call the backend for the cache misses.
    if (!userToken) {
      this.logger.warn(
        `No token available for ABAC evaluation of ${userEntityRef} — failing closed`,
      );
      for (const i of missingIdx) results[i] = false;
      return results as boolean[];
    }

    const subject = await this.getSubjectContextForUser(
      userEntityRef,
      userToken,
    );
    if (!subject) {
      this.logger.warn(
        `No subject context available for ${userEntityRef} — failing closed`,
      );
      for (const i of missingIdx) results[i] = false;
      return results as boolean[];
    }

    const requests: EvaluateRequest[] = missingIdx.map(i => {
      const { action, resourcePath } = inputs[i];
      const parsed = parseCapabilityPath(resourcePath);
      const hierarchy = {
        namespace:
          parsed?.namespace && parsed.namespace !== '*'
            ? parsed.namespace
            : undefined,
        project:
          parsed?.project && parsed.project !== '*'
            ? parsed.project
            : undefined,
        component:
          parsed?.component && parsed.component !== '*'
            ? parsed.component
            : undefined,
      };
      // Resource type is derived from the most specific hierarchy level present
      // — this matches how the OpenChoreo authz core scopes evaluations.
      let resourceType: string;
      if (hierarchy.component) {
        resourceType = 'component';
      } else if (hierarchy.project) {
        resourceType = 'project';
      } else if (hierarchy.namespace) {
        resourceType = 'namespace';
      } else {
        resourceType = 'cluster';
      }

      const req: EvaluateRequest = {
        subject_context: subject,
        resource: { type: resourceType, hierarchy },
        action,
      };
      const encodedEnv = encodedEnvs[i];
      if (encodedEnv) {
        req.context = { resource: { environment: encodedEnv } };
      }
      return req;
    });

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST(
        '/api/v1/authz/evaluates',
        { body: requests },
      );
      assertApiResponse({ data, error, response }, 'evaluate capabilities');

      const decisions = (data ?? []) as Array<{ decision: boolean }>;
      const ttlMs = getTtlFromToken(userToken);

      for (let j = 0; j < missingIdx.length; j++) {
        const i = missingIdx[j];
        const allowed = decisions[j]?.decision === true;
        results[i] = allowed;
        if (this.cache) {
          const { action, resourcePath } = inputs[i];
          // Use the encoded env so cache keys match the form sent to the
          // backend (and stay isolated per namespace).
          await this.cache.setEvaluation(
            userEntityRef,
            tokenHash,
            action,
            resourcePath,
            encodedEnvs[i],
            allowed,
            ttlMs,
          );
        }
      }
    } catch (err) {
      this.logger.error(`ABAC evaluate failed for ${userEntityRef}: ${err}`);
      // Fail closed
      for (const i of missingIdx) {
        if (results[i] === undefined) results[i] = false;
      }
    }

    return results as boolean[];
  }

  /**
   * Returns the subject context for a user, reusing the cached profile when
   * possible. Falls back to fetching the profile when not cached.
   */
  private async getSubjectContextForUser(
    userEntityRef: string,
    userToken: string,
  ): Promise<SubjectContext | undefined> {
    let profile = this.cache
      ? await this.cache.getByUser(userEntityRef, 'global')
      : undefined;
    if (!profile) {
      profile = await this.getCapabilities(userToken);
    }
    const user = profile?.user as Partial<SubjectContext> | undefined;
    if (
      !user ||
      !user.type ||
      !user.entitlement_claim ||
      !user.entitlement_values
    ) {
      return undefined;
    }
    return {
      type: user.type,
      entitlement_claim: user.entitlement_claim,
      entitlement_values: user.entitlement_values,
    };
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
