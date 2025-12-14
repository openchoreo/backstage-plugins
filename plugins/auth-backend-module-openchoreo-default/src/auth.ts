import {
  createBackendModule,
  coreServices,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
  createOAuthAuthenticator,
  PassportOAuthAuthenticatorHelper,
  PassportOAuthDoneCallback,
  ProfileInfo,
  AuthResolverContext,
  OAuthAuthenticatorResult,
} from '@backstage/plugin-auth-node';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import {
  stringifyEntityRef,
  DEFAULT_NAMESPACE,
} from '@backstage/catalog-model';
import {
  OpenChoreoTokenPayload,
  decodeJwtUnsafe,
  isTokenExpired,
  getTimeUntilExpiry,
} from './jwtUtils';

/**
 * Extracts profile info from a decoded JWT payload
 */
function extractProfileFromPayload(
  payload: OpenChoreoTokenPayload,
): ProfileInfo {
  return {
    email: payload.username, // username contains the email
    displayName:
      payload.given_name && payload.family_name
        ? `${payload.given_name} ${payload.family_name}`
        : payload.username,
    picture: undefined, // Not available in the token
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
  // Extract profile information from JWT tokens since OAuth2 doesn't provide userInfo
  // The session is available directly in result.session
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
 * Custom OAuth authenticator for OpenChoreo Default IDP
 * Uses OAuth2 strategy without OIDC discovery endpoint
 */
export const defaultIdpAuthenticator = createOAuthAuthenticator({
  defaultProfileTransform: customProfileTransform,
  scopes: {
    required: ['openid', 'profile', 'email'],
  },

  initialize({ callbackUrl, config }) {
    const clientID = config.getString('clientId');
    const clientSecret = config.getString('clientSecret');
    const authorizationURL = config.getString('authorizationUrl');
    const tokenURL = config.getString('tokenUrl');
    const scope = config.getString('scope');

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
          provider: 'default-idp',
          id: 'temp-id', // Will be replaced by profile transform
          displayName: 'temp-display-name', // Will be replaced by profile transform
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

    // OpenChoreo at the moment doesn't return refresh tokens, so we use the access token
    // as a pseudo-refresh token. Since the access token is valid for 3600 seconds,
    // we can use it to maintain the session without actual OAuth refresh.
    // TODO: Remove this once OpenChoreo returns refresh tokens.
    if (!session.refreshToken) {
      // Prefix to identify this as a pseudo-refresh token
      session.refreshToken = `openchoreo-pseudo-refresh:${session.accessToken}`;
    }

    return { fullProfile, session };
  },

  async refresh(input, helper) {
    const { refreshToken } = input;

    // Check if this is our pseudo-refresh token
    if (refreshToken?.startsWith('openchoreo-pseudo-refresh:')) {
      // Extract the original access token
      const accessToken = refreshToken.replace(
        'openchoreo-pseudo-refresh:',
        '',
      );

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
      // This allows Backstage to re-issue user tokens without calling the OAuth provider
      // We need to return the same structure as helper.refresh() would return
      const result: OAuthAuthenticatorResult<any> = {
        fullProfile: {
          provider: 'default-idp',
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
          idToken: payload.jti, // Use JTI as ID token placeholder
          scope: payload.scope || 'openid profile email',
          expiresInSeconds: timeUntilExpiry,
          refreshToken, // Keep the same pseudo-refresh token
        },
      };

      return result;
    }

    // Fallback to default refresh behavior (will likely fail)
    return helper.refresh(input);
  },
});

/**
 * Default IDP auth provider module for OpenChoreo
 * Custom OAuth provider without OIDC discovery endpoint
 *
 * This provider checks the openchoreo.features.auth.enabled config flag.
 * When disabled (false), this provider skips registration to allow guest mode.
 */
export const OpenChoreoDefaultAuthModule = createBackendModule({
  pluginId: 'auth',
  moduleId: 'default-idp',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ providers, logger, config }) {
        // Check if auth feature is enabled (defaults to true)
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        if (!authEnabled) {
          logger.info(
            'OpenChoreo default-idp auth provider disabled via openchoreo.features.auth.enabled=false',
          );
          return;
        }

        providers.registerProvider({
          providerId: 'default-idp',
          factory: createOAuthProviderFactory({
            authenticator: defaultIdpAuthenticator,
            signInResolver: async (info, ctx) => {
              const { profile } = info;

              // Handle case where profile might be undefined
              if (!profile || !profile.email) {
                throw new Error(
                  'User profile/email is undefined. Check if customProfileTransform is working correctly.',
                );
              }

              // Extract groups from access token (where the group claim is located)
              const accessToken = (info.result as any).session?.accessToken;

              let groups: string[] = [];
              if (accessToken) {
                const payload = decodeJwtUnsafe(accessToken);
                if (payload?.groups && Array.isArray(payload.groups)) {
                  groups = payload.groups;
                } else if (!payload) {
                  logger.warn(
                    'Failed to decode access token for group extraction',
                  );
                }
              }

              // Build entity references
              const userEntityRef = stringifyEntityRef({
                kind: 'User',
                namespace: DEFAULT_NAMESPACE,
                name: profile.email,
              });

              const ownershipEntityRefs = [
                userEntityRef,
                ...groups.map(group =>
                  stringifyEntityRef({
                    kind: 'Group',
                    namespace: DEFAULT_NAMESPACE,
                    name: group.toLowerCase(),
                  }),
                ),
              ];

              // Issue token with user and group ownership
              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: ownershipEntityRefs,
                },
              });
            },
          }),
        });
      },
    });
  },
});
