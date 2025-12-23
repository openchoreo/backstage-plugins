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
import { execSync } from 'child_process';
import {
  OpenChoreoTokenPayload,
  decodeJwtUnsafe,
  isTokenExpired,
  getTimeUntilExpiry,
} from './jwtUtils';

const PSEUDO_REFRESH_PREFIX = 'openchoreo-pseudo-refresh:';

/**
 * OIDC Discovery Configuration
 */
interface OIDCDiscoveryConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  issuer?: string;
}

/**
 * Fetches OIDC discovery configuration from a metadata URL.
 * Uses synchronous HTTP fetch since initialize() must be synchronous.
 */
function fetchOIDCDiscoverySync(metadataUrl: string): OIDCDiscoveryConfig {
  try {
    // Use curl via execSync for synchronous HTTP fetch
    const result = execSync(`curl -s --max-time 10 "${metadataUrl}"`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    const config = JSON.parse(result) as OIDCDiscoveryConfig;

    if (!config.authorization_endpoint || !config.token_endpoint) {
      throw new Error(
        'OIDC discovery response missing required endpoints (authorization_endpoint, token_endpoint)',
      );
    }

    return config;
  } catch (error) {
    throw new Error(
      `Failed to fetch OIDC discovery from ${metadataUrl}: ${error}`,
    );
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

    // If metadataUrl is provided and explicit URLs are missing, use OIDC discovery
    if (metadataUrl && (!authorizationURL || !tokenURL)) {
      const discoveredConfig = fetchOIDCDiscoverySync(metadataUrl);
      authorizationURL =
        authorizationURL || discoveredConfig.authorization_endpoint;
      tokenURL = tokenURL || discoveredConfig.token_endpoint;
    }

    // Validate that we have the required URLs
    if (!authorizationURL || !tokenURL) {
      throw new Error(
        'OpenChoreo auth configuration error: Either metadataUrl or both authorizationUrl and tokenUrl must be provided',
      );
    }

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
