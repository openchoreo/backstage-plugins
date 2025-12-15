import { CacheService } from '@backstage/backend-plugin-api';
import crypto from 'crypto';
import type { UserCapabilitiesResponse } from './types';

/**
 * Configuration options for the AuthzProfileCache.
 */
export interface AuthzProfileCacheOptions {
  /**
   * Default time-to-live for cached capabilities in milliseconds.
   */
  defaultTtlMs: number;
}

/**
 * Cache for user capabilities from the OpenChoreo /authz/profile API.
 *
 * Caches capabilities keyed by a hash of the user token and scope,
 * preventing excessive API calls while maintaining security by not
 * storing the actual token in cache keys.
 */
export class AuthzProfileCache {
  private readonly cache: CacheService;
  private readonly defaultTtlMs: number;

  constructor(cache: CacheService, options: AuthzProfileCacheOptions) {
    this.cache = cache.withOptions({
      defaultTtl: options.defaultTtlMs,
    });
    this.defaultTtlMs = options.defaultTtlMs;
  }

  /**
   * Builds a cache key from the user token and scope.
   * Uses a hash of the token to avoid storing sensitive data.
   */
  private buildKey(
    userToken: string,
    org: string,
    project?: string,
    component?: string,
  ): string {
    const tokenHash = crypto
      .createHash('sha256')
      .update(userToken)
      .digest('hex')
      .substring(0, 16);

    const parts = ['openchoreo', 'capabilities', tokenHash, org];
    if (project) parts.push(project);
    if (component) parts.push(component);

    return parts.join(':');
  }

  /**
   * Retrieves cached capabilities for the given user and scope.
   *
   * @param userToken - The user's OpenChoreo token
   * @param org - Organization name
   * @param project - Optional project name
   * @param component - Optional component name
   * @returns Cached capabilities or undefined if not found
   */
  async get(
    userToken: string,
    org: string,
    project?: string,
    component?: string,
  ): Promise<UserCapabilitiesResponse | undefined> {
    const key = this.buildKey(userToken, org, project, component);
    return this.cache.get<UserCapabilitiesResponse>(key);
  }

  /**
   * Stores capabilities in the cache.
   *
   * @param userToken - The user's OpenChoreo token
   * @param org - Organization name
   * @param capabilities - The capabilities response to cache
   * @param project - Optional project name
   * @param component - Optional component name
   * @param ttlMs - Optional custom TTL in milliseconds
   */
  async set(
    userToken: string,
    org: string,
    capabilities: UserCapabilitiesResponse,
    project?: string,
    component?: string,
    ttlMs?: number,
  ): Promise<void> {
    const key = this.buildKey(userToken, org, project, component);
    await this.cache.set(key, capabilities, {
      ttl: ttlMs ?? this.defaultTtlMs,
    });
  }

  /**
   * Deletes cached capabilities for the given user and scope.
   *
   * @param userToken - The user's OpenChoreo token
   * @param org - Organization name
   * @param project - Optional project name
   * @param component - Optional component name
   */
  async delete(
    userToken: string,
    org: string,
    project?: string,
    component?: string,
  ): Promise<void> {
    const key = this.buildKey(userToken, org, project, component);
    await this.cache.delete(key);
  }
}
