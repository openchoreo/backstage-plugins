/**
 * Configuration for OpenChoreo authentication using OAuth2 client credentials grant.
 * Used for background tasks like Catalog Provider that don't have a user context.
 */
export interface OpenChoreoAuthConfig {
  /**
   * OAuth2 client ID for client credentials grant
   */
  clientId: string;

  /**
   * OAuth2 client secret for client credentials grant
   */
  clientSecret: string;

  /**
   * OAuth2 token endpoint URL
   */
  tokenUrl: string;

  /**
   * OAuth2 scopes to request (optional)
   */
  scopes?: string[];
}

/**
 * Cached token with expiration tracking
 */
export interface CachedToken {
  /**
   * The access token
   */
  accessToken: string;

  /**
   * Timestamp when the token expires (ms since epoch)
   */
  expiresAt: number;
}

/**
 * OAuth2 token response from the IDP
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Header name used to pass the user's IDP token from frontend to backend
 */
export const OPENCHOREO_TOKEN_HEADER = 'x-openchoreo-token';
