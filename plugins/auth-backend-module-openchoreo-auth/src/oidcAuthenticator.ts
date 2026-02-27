import {
  createOAuthAuthenticator,
  PassportOAuthAuthenticatorHelper,
  PassportOAuthDoneCallback,
  OAuthAuthenticatorResult,
  AuthResolverContext,
  ProfileInfo,
} from '@backstage/plugin-auth-node';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  OpenChoreoTokenPayload,
  decodeJwtUnsafe,
  isTokenExpired,
  getTimeUntilExpiry,
  verifyAndDecodeJwt,
} from './jwtUtils';
import syncFetch from 'sync-fetch';

const PSEUDO_REFRESH_PREFIX = 'openchoreo-pseudo-refresh:';

/**
 * OIDC Discovery Configuration
 */
interface OIDCDiscoveryConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  issuer?: string;
  jwks_uri?: string;
}

// Cache for OIDC discovery results
let discoveryCache: OIDCDiscoveryConfig | null = null;

// Trusted JWKS URL resolved during initialize() from config/discovery
let trustedJwksUrl: string | null = null;

/**
 * Fetches OIDC discovery configuration from a metadata URL (synchronous with caching).
 * Returns null if discovery fails.
 */
function fetchOIDCDiscoverySync(
  metadataUrl: string,
): OIDCDiscoveryConfig | null {
  if (discoveryCache) {
    return discoveryCache;
  }

  try {
    const response = syncFetch(metadataUrl);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[openchoreo-auth] OIDC discovery failed: HTTP ${response.status} from ${metadataUrl}`,
      );
      return null;
    }

    const config = response.json() as OIDCDiscoveryConfig;

    if (!config.authorization_endpoint || !config.token_endpoint) {
      // eslint-disable-next-line no-console
      console.warn(
        '[openchoreo-auth] OIDC discovery response missing required endpoints',
      );
      return null;
    }

    discoveryCache = config;
    return config;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[openchoreo-auth] OIDC discovery failed for ${metadataUrl}:`,
      error,
    );
    return null;
  }
}

/**
 * Extracts profile info from a decoded JWT payload
 */
function extractProfileFromPayload(
  payload: OpenChoreoTokenPayload,
): ProfileInfo {
  return {
    email: payload.username,
    displayName:
      payload.given_name && payload.family_name
        ? `${payload.given_name} ${payload.family_name}`
        : payload.username,
    picture: undefined,
  };
}

/**
 * Custom profile transform that extracts user info from JWT tokens
 */
const customProfileTransform = async (
  result: OAuthAuthenticatorResult<any>,
  _context: AuthResolverContext,
  logger?: LoggerService,
): Promise<{ profile: ProfileInfo }> => {
  const session = result.session;
  const accessToken = session?.accessToken;
  const idToken = session?.idToken;

  let profile: ProfileInfo = {};

  // Try to extract from access token first
  if (accessToken) {
    const payload = decodeJwtUnsafe(accessToken);
    if (payload) {
      profile = extractProfileFromPayload(payload);
    } else {
      logger?.warn('Failed to decode access token for profile');
    }
  }

  // Fallback to ID token if access token didn't work
  if (!profile.email && idToken) {
    const payload = decodeJwtUnsafe(idToken);
    if (payload) {
      profile = extractProfileFromPayload(payload);
    } else {
      logger?.warn('Failed to decode ID token for profile');
    }
  }

  return { profile };
};

/**
 * OpenChoreo OAuth authenticator
 *
 * Features:
 * - Supports OIDC discovery via metadataUrl OR explicit authorizationUrl/tokenUrl
 * - Uses OAuth2 strategy with passport-oauth2
 * - Includes pseudo-refresh token workaround for IDPs that don't return refresh tokens
 * - Extracts user profile from JWT tokens
 *
 * Configuration priority:
 * 1. If metadataUrl is provided, fetches OIDC configuration via discovery
 * 2. Explicit authorizationUrl/tokenUrl override discovered values if both are provided
 */
export const openChoreoAuthenticator = createOAuthAuthenticator({
  defaultProfileTransform: customProfileTransform,
  scopes: {
    required: ['openid', 'profile', 'email'],
  },

  initialize({ callbackUrl, config }) {
    const clientID = config.getString('clientId');
    const clientSecret = config.getString('clientSecret');
    const scope = config.getOptionalString('scope') || 'openid profile email';

    // Support both OIDC discovery and explicit URLs
    const metadataUrl = config.getOptionalString('metadataUrl');
    let authorizationURL = config.getOptionalString('authorizationUrl');
    let tokenURL = config.getOptionalString('tokenUrl');

    // Try OIDC discovery: use explicit metadataUrl, or derive from tokenUrl
    const discoveryUrl =
      metadataUrl ??
      (tokenURL
        ? `${new URL(tokenURL).origin}/.well-known/openid-configuration`
        : undefined);

    if (discoveryUrl) {
      const discovered = fetchOIDCDiscoverySync(discoveryUrl);

      if (discovered) {
        // Use discovered endpoints, but explicit URLs take precedence if provided
        if (!authorizationURL) {
          authorizationURL = discovered.authorization_endpoint;
        }
        if (!tokenURL) {
          tokenURL = discovered.token_endpoint;
        }
      }
      // If discovery failed, fall through to use explicit URLs if available
    }

    // Validate we have the required URLs (either from discovery or explicit config)
    if (!authorizationURL || !tokenURL) {
      throw new Error(
        'OpenChoreo auth configuration error: Either metadataUrl (with valid OIDC discovery) or both authorizationUrl and tokenUrl must be provided',
      );
    }

    // Use jwks_uri from discovery; JWKS verification is skipped if unavailable
    trustedJwksUrl = discoveryCache?.jwks_uri ?? null;

    const strategy = new OAuth2Strategy(
      {
        clientID,
        clientSecret,
        callbackURL: callbackUrl,
        authorizationURL,
        tokenURL,
        scope,
      },
      (
        accessToken: string,
        refreshToken: string,
        params: any,
        _fullProfile: any,
        done: PassportOAuthDoneCallback,
      ) => {
        // Create a minimal PassportProfile for compatibility
        const passportProfile = {
          provider: 'openchoreo-auth',
          id: 'temp-id',
          displayName: 'temp-display-name',
        };

        done(
          undefined,
          {
            fullProfile: passportProfile,
            accessToken,
            params,
          },
          { refreshToken },
        );
      },
    );

    return PassportOAuthAuthenticatorHelper.from(strategy);
  },

  async start(input, helper) {
    return helper.start(input, {});
  },

  async authenticate(input, helper) {
    const { fullProfile, session } = await helper.authenticate(input);

    // Add pseudo-refresh token if no real refresh token was returned
    // This allows session maintenance for IDPs that don't return refresh tokens
    if (!session.refreshToken) {
      session.refreshToken = `${PSEUDO_REFRESH_PREFIX}${session.accessToken}`;
    }

    return { fullProfile, session };
  },

  async refresh(input, helper) {
    const { refreshToken } = input;

    // Check if this is our pseudo-refresh token
    if (refreshToken?.startsWith(PSEUDO_REFRESH_PREFIX)) {
      // Extract the original access token
      const accessToken = refreshToken.replace(PSEUDO_REFRESH_PREFIX, '');

      // Decode the JWT to check expiration
      const payload = decodeJwtUnsafe(accessToken);
      if (!payload) {
        throw new Error(
          'Invalid access token format, re-authentication required',
        );
      }

      // If token is expired or about to expire (less than 60 seconds), fail the refresh
      if (isTokenExpired(payload, 60)) {
        throw new Error('Access token expired, re-authentication required');
      }

      // Verify token signature against current JWKS
      // This catches stale tokens from a recreated IDP instance
      // Uses trusted JWKS URL from config/discovery, not the unverified token payload
      if (trustedJwksUrl) {
        try {
          await verifyAndDecodeJwt(accessToken, trustedJwksUrl);
        } catch {
          throw new Error(
            'Access token signature verification failed, re-authentication required',
          );
        }
      }

      const timeUntilExpiry = getTimeUntilExpiry(payload);

      // Token is still valid, return the same session
      const result: OAuthAuthenticatorResult<any> = {
        fullProfile: {
          provider: 'openchoreo-auth',
          id: payload.sub,
          displayName:
            payload.given_name && payload.family_name
              ? `${payload.given_name} ${payload.family_name}`
              : payload.username,
          emails: [{ value: payload.username }],
        },
        session: {
          accessToken,
          tokenType: 'Bearer',
          idToken: payload.jti,
          scope: payload.scope || 'openid profile email',
          expiresInSeconds: timeUntilExpiry,
          refreshToken,
        },
      };

      return result;
    }

    // Fallback to default refresh behavior
    return helper.refresh(input);
  },
});
