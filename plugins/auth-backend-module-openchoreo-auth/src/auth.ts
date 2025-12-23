import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import {
  stringifyEntityRef,
  DEFAULT_NAMESPACE,
} from '@backstage/catalog-model';
import { openChoreoAuthenticator } from './oidcAuthenticator';
import { decodeJwtUnsafe } from './jwtUtils';

/**
 * OpenChoreo authentication backend module for Backstage.
 *
 * This module provides OAuth authentication for OpenChoreo.
 * It works with any OAuth2/OIDC-compliant identity provider configured in OpenChoreo.
 *
 * Features:
 * - Uses OAuth2 with explicit authorizationUrl and tokenUrl
 * - Includes pseudo-refresh token workaround for IDPs without refresh tokens
 * - Extracts user profile from JWT tokens
 * - Pre-caches user capabilities at sign-in for permission checks
 *
 * Configuration:
 * ```yaml
 * auth:
 *   providers:
 *     openchoreo-auth:
 *       development:
 *         clientId: ${OPENCHOREO_AUTH_CLIENT_ID}
 *         clientSecret: ${OPENCHOREO_AUTH_CLIENT_SECRET}
 *         authorizationUrl: ${OPENCHOREO_AUTH_AUTHORIZATION_URL}
 *         tokenUrl: ${OPENCHOREO_AUTH_TOKEN_URL}
 *         scope: 'openid profile email'
 * ```
 *
 * This provider checks the openchoreo.features.auth.enabled config flag.
 * When disabled (false), this provider skips registration to allow guest mode.
 */
export const OpenChoreoAuthModule = createBackendModule({
  pluginId: 'auth',
  moduleId: 'openchoreo-auth',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
      },
      async init({ providers, logger, config, discovery }) {
        // Check if auth feature is enabled (defaults to true)
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        if (!authEnabled) {
          logger.info(
            'OpenChoreo auth provider disabled via openchoreo.features.auth.enabled=false',
          );
          return;
        }

        providers.registerProvider({
          providerId: 'openchoreo-auth',
          factory: createOAuthProviderFactory({
            authenticator: openChoreoAuthenticator,
            signInResolver: async (info, ctx) => {
              const { profile } = info;

              // Handle case where profile might be undefined
              if (!profile || !profile.email) {
                throw new Error(
                  'User profile/email is undefined. Check if the identity provider is returning user info correctly.',
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

              // Also check userinfo for groups (OIDC standard)
              const userinfo = (info.result as any).fullProfile?.userinfo;
              if (userinfo?.groups && Array.isArray(userinfo.groups)) {
                groups = [...new Set([...groups, ...userinfo.groups])];
              } else if (
                userinfo?.group &&
                typeof userinfo.group === 'string'
              ) {
                groups = [...new Set([...groups, userinfo.group])];
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

              // Pre-cache capabilities for permission checks
              // This ensures capabilities are available even for internal service calls
              if (accessToken) {
                try {
                  const permissionBaseUrl = await discovery.getBaseUrl(
                    'permission',
                  );
                  const response = await fetch(
                    `${permissionBaseUrl}/cache-capabilities`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userEntityRef, accessToken }),
                    },
                  );
                  if (response.ok) {
                    logger.info(`Pre-cached capabilities for ${userEntityRef}`);
                  } else {
                    logger.warn(
                      `Failed to pre-cache capabilities: ${response.status} ${response.statusText}`,
                    );
                  }
                } catch (error) {
                  // Log but don't fail sign-in if caching fails
                  logger.warn(
                    `Failed to pre-cache capabilities for ${userEntityRef}: ${error}`,
                  );
                }
              }

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

        logger.info('OpenChoreo auth provider registered');
      },
    });
  },
});
