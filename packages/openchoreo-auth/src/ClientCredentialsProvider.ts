import { LoggerService } from '@backstage/backend-plugin-api';
import { decodeJwt } from 'jose';
import { OpenChoreoAuthConfig, CachedToken, TokenResponse } from './types';

/**
 * Token buffer time in milliseconds.
 * Refresh token 60 seconds before expiration to avoid edge cases.
 */
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

/** Number of token-fetch attempts before giving up. */
const TOKEN_FETCH_MAX_ATTEMPTS = 3;
/** Base backoff between token-fetch retries (doubles each attempt). */
const TOKEN_FETCH_BASE_DELAY_MS = 1000;

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Error from a single token request, tagged with whether retrying could help.
 * Network failures and 5xx are retryable; 4xx (e.g. bad credentials) are not.
 */
class TokenRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'TokenRequestError';
  }
}

/**
 * Provides OAuth2 access tokens using the client credentials grant flow.
 * Used for background tasks that don't have a user context.
 *
 * Features:
 * - Token caching with automatic refresh
 * - Thread-safe token acquisition
 * - Configurable scopes
 */
export class ClientCredentialsProvider {
  private cachedToken: CachedToken | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(
    private readonly config: OpenChoreoAuthConfig,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Gets a valid access token, refreshing if necessary.
   * This method is thread-safe - concurrent calls will share the same token request.
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    // If a token request is already in progress, wait for it
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // Start a new token request
    this.tokenPromise = this.fetchNewToken();

    try {
      const token = await this.tokenPromise;
      return token;
    } finally {
      this.tokenPromise = null;
    }
  }

  /**
   * Checks if a cached token is still valid (not expired).
   */
  private isTokenValid(token: CachedToken): boolean {
    const isValid = Date.now() < token.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
    return isValid;
  }

  /**
   * Fetches a new access token, retrying transient failures with exponential
   * backoff. Only network errors and 5xx responses are retried; 4xx (e.g. bad
   * credentials) fail immediately since retrying cannot help.
   */
  private async fetchNewToken(): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= TOKEN_FETCH_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.requestToken();
      } catch (error) {
        lastError = error;
        const retryable =
          !(error instanceof TokenRequestError) || error.retryable;
        if (!retryable || attempt === TOKEN_FETCH_MAX_ATTEMPTS) {
          break;
        }
        const backoffMs = TOKEN_FETCH_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Client credentials token fetch attempt ${attempt}/${TOKEN_FETCH_MAX_ATTEMPTS} failed; retrying in ${backoffMs}ms: ${error}`,
        );
        await delay(backoffMs);
      }
    }
    this.logger.error(
      'Failed to fetch client credentials token',
      lastError as Error,
    );
    throw lastError;
  }

  /**
   * Performs a single token request against the OAuth2 token endpoint.
   * Throws a {@link TokenRequestError} on non-ok responses.
   */
  private async requestToken(): Promise<string> {
    this.logger.debug('Fetching new client credentials token');

    const { clientId, clientSecret, tokenUrl, scopes } = this.config;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    if (scopes && scopes.length > 0) {
      params.set('scope', scopes.join(' '));
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TokenRequestError(
        `Token request failed: ${response.status} ${response.statusText} - ${errorText}`,
        response.status >= 500,
      );
    }

    const tokenResponse: TokenResponse = await response.json();

    // Decode JWT to extract the actual expiration time from the exp claim
    // This is more accurate than using expires_in, which doesn't account for
    // time elapsed between token issuance and response receipt
    let expiresAt: number;
    try {
      const decodedToken = decodeJwt(tokenResponse.access_token);
      if (decodedToken.exp) {
        // exp claim is in seconds, convert to milliseconds
        expiresAt = decodedToken.exp * 1000;
        this.logger.debug(
          `Using JWT exp claim for expiry: ${expiresAt} (${new Date(
            expiresAt,
          ).toISOString()})`,
        );
      } else {
        // Fallback to expires_in if exp claim is missing
        expiresAt = Date.now() + tokenResponse.expires_in * 1000;
        this.logger.debug(
          `JWT exp claim missing, falling back to expires_in calculation: ${expiresAt}`,
        );
      }
    } catch (error) {
      // Fallback to expires_in if JWT decoding fails
      expiresAt = Date.now() + tokenResponse.expires_in * 1000;
      this.logger.debug(
        `Failed to decode JWT token, falling back to expires_in calculation: ${error}`,
      );
    }

    // Cache the token
    this.cachedToken = {
      accessToken: tokenResponse.access_token,
      expiresAt,
    };

    const expiresInSeconds = Math.round((expiresAt - Date.now()) / 1000);
    this.logger.debug(
      `Successfully obtained client credentials token, expires in ${expiresInSeconds}s at ${new Date(
        expiresAt,
      ).toISOString()}`,
    );

    return tokenResponse.access_token;
  }

  /**
   * Clears the cached token, forcing a refresh on next getToken() call.
   */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenPromise = null;
  }
}
