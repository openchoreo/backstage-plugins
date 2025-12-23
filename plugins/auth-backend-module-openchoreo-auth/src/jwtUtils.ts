import * as jose from 'jose';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * JWT token payload interface for OpenChoreo tokens
 */
export interface OpenChoreoTokenPayload {
  sub: string;
  username: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  ouHandle?: string;
  ouId?: string;
  ouName?: string;
  userType?: string;
  client_id?: string;
  grant_type?: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  scope?: string;
  auth_time?: number;
}

/**
 * Cache for JWKS to avoid fetching on every request
 */
let jwksCache: {
  jwks: jose.JSONWebKeySet | null;
  fetchedAt: number;
  url: string;
} | null = null;

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Derives the JWKS URL from the token URL
 * e.g., http://thunder.localhost:8080/oauth2/token -> http://thunder.localhost:8080/.well-known/jwks.json
 */
export function deriveJwksUrl(tokenUrl: string): string {
  const url = new URL(tokenUrl);
  url.pathname = '/.well-known/jwks.json';
  return url.toString();
}

/**
 * Fetches JWKS from the given URL with caching
 */
async function fetchJwks(
  jwksUrl: string,
  logger?: LoggerService,
): Promise<jose.JSONWebKeySet> {
  const now = Date.now();

  // Return cached JWKS if still valid
  if (
    jwksCache &&
    jwksCache.url === jwksUrl &&
    jwksCache.jwks &&
    now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS
  ) {
    return jwksCache.jwks;
  }

  try {
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch JWKS: ${response.status} ${response.statusText}`,
      );
    }

    const jwks = (await response.json()) as jose.JSONWebKeySet;

    // Update cache
    jwksCache = {
      jwks,
      fetchedAt: now,
      url: jwksUrl,
    };

    logger?.debug(`Fetched and cached JWKS from ${jwksUrl}`);
    return jwks;
  } catch (error) {
    logger?.warn(`Failed to fetch JWKS from ${jwksUrl}:`, error as Error);
    throw error;
  }
}

/**
 * Verifies and decodes a JWT token using JWKS
 *
 * @param token - The JWT token to verify
 * @param jwksUrl - The URL to fetch JWKS from
 * @param logger - Optional logger for debugging
 * @returns The verified token payload
 * @throws Error if verification fails
 */
export async function verifyAndDecodeJwt(
  token: string,
  jwksUrl: string,
  logger?: LoggerService,
): Promise<OpenChoreoTokenPayload> {
  try {
    const jwks = await fetchJwks(jwksUrl, logger);
    const JWKS = jose.createLocalJWKSet(jwks);

    const { payload } = await jose.jwtVerify(token, JWKS);

    return payload as unknown as OpenChoreoTokenPayload;
  } catch (error) {
    logger?.warn('JWT verification failed:', error as Error);
    throw new Error(`JWT verification failed: ${(error as Error).message}`);
  }
}

/**
 * Decodes a JWT token WITHOUT verification
 * Use this only when verification is not possible (e.g., JWKS unavailable)
 * or when the token source is already trusted.
 *
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if decoding fails
 */
export function decodeJwtUnsafe(token: string): OpenChoreoTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8'),
    );

    return payload as OpenChoreoTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Checks if a token is expired
 *
 * @param payload - The decoded token payload
 * @param bufferSeconds - Buffer time before expiry (default 60 seconds)
 * @returns true if token is expired or will expire within buffer time
 */
export function isTokenExpired(
  payload: OpenChoreoTokenPayload,
  bufferSeconds: number = 60,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now < bufferSeconds;
}

/**
 * Gets the time until token expiry in seconds
 *
 * @param payload - The decoded token payload
 * @returns Seconds until expiry (negative if already expired)
 */
export function getTimeUntilExpiry(payload: OpenChoreoTokenPayload): number {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now;
}
