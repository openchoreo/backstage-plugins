import { CacheService } from '@backstage/backend-plugin-api';
import crypto from 'crypto';
import type { UserCapabilitiesResponse } from './types';

/**
 * Cache for user capabilities from the OpenChoreo /authz/profile API.
 *
 * Caches capabilities keyed by a hash of the user token and scope,
 * preventing excessive API calls while maintaining security by not
 * storing the actual token in cache keys.
 *
 * TTL is derived from the JWT token expiration to ensure cached data
 * never outlives the token.
 */
export class AuthzProfileCache {
  private readonly cache: CacheService;

  constructor(cache: CacheService) {
    this.cache = cache;
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
   * @param org - Namespace name
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
   * @param org - Namespace name
   * @param capabilities - The capabilities response to cache
   * @param ttlMs - TTL in milliseconds (derived from token expiration)
   * @param project - Optional project name
   * @param component - Optional component name
   */
  async set(
    userToken: string,
    org: string,
    capabilities: UserCapabilitiesResponse,
    ttlMs: number,
    project?: string,
    component?: string,
  ): Promise<void> {
    const key = this.buildKey(userToken, org, project, component);
    await this.cache.set(key, capabilities, { ttl: ttlMs });
  }

  /**
   * Deletes cached capabilities for the given user and scope.
   *
   * @param userToken - The user's OpenChoreo token
   * @param org - Namespace name
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

  /**
   * Builds a cache key from the user entity ref.
   * This allows looking up capabilities by user identity without needing the token.
   */
  private buildUserKey(userEntityRef: string, org?: string): string {
    const parts = ['openchoreo', 'capabilities', 'user', userEntityRef];
    if (org) parts.push(org);
    return parts.join(':');
  }

  /**
   * Retrieves cached capabilities by user entity ref.
   * This is used when the token is not available (e.g., internal permission calls).
   *
   * @param userEntityRef - The user's entity reference (e.g., "user:default/email@example.com")
   * @param org - Optional namespace name
   * @returns Cached capabilities or undefined if not found
   */
  async getByUser(
    userEntityRef: string,
    org?: string,
  ): Promise<UserCapabilitiesResponse | undefined> {
    const key = this.buildUserKey(userEntityRef, org);
    return this.cache.get<UserCapabilitiesResponse>(key);
  }

  /**
   * Stores capabilities in the cache keyed by user entity ref.
   * This allows permission checks to work without the token.
   *
   * @param userEntityRef - The user's entity reference
   * @param capabilities - The capabilities response to cache
   * @param ttlMs - TTL in milliseconds (derived from token expiration)
   * @param org - Optional namespace name
   */
  async setByUser(
    userEntityRef: string,
    capabilities: UserCapabilitiesResponse,
    ttlMs: number,
    org?: string,
  ): Promise<void> {
    const key = this.buildUserKey(userEntityRef, org);
    await this.cache.set(key, capabilities, { ttl: ttlMs });
  }
}
