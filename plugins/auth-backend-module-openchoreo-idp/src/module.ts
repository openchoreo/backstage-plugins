import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { oidcAuthenticator } from '@backstage/plugin-auth-backend-module-oidc-provider';
import {
  stringifyEntityRef,
  DEFAULT_NAMESPACE,
} from '@backstage/catalog-model';

/**
 * OpenChoreo IDP authentication module for Backstage.
 *
 * Uses the built-in OIDC authenticator with Thunder IDP.
 * Can be disabled via `openchoreo.features.auth.enabled: false` config.
 *
 * @public
 */
export const openChoreoIdpAuthModule = createBackendModule({
  pluginId: 'auth',
  moduleId: 'openchoreo-idp',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ providers, logger, config }) {
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        if (!authEnabled) {
          logger.info(
            'OpenChoreo IDP auth provider disabled via openchoreo.features.auth.enabled=false',
          );
          return;
        }

        providers.registerProvider({
          providerId: 'openchoreo-idp',
          factory: createOAuthProviderFactory({
            authenticator: oidcAuthenticator,
            signInResolver: async (info, ctx) => {
              const { profile } = info;

              if (!profile?.email) {
                throw new Error(
                  'Login failed: user email is required but was not provided by the identity provider',
                );
              }

              // Extract groups from OIDC userinfo
              const groups: string[] = [];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const userinfo = (info.result as any).fullProfile?.userinfo;
              if (userinfo?.groups && Array.isArray(userinfo.groups)) {
                groups.push(...userinfo.groups);
              } else if (userinfo?.group) {
                groups.push(userinfo.group as string);
              }

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

              logger.debug(
                `User ${profile.email} signed in with groups: ${
                  groups.join(', ') || 'none'
                }`,
              );

              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: ownershipEntityRefs,
                },
              });
            },
          }),
        });

        logger.info('OpenChoreo IDP auth provider registered');
      },
    });
  },
});

export default openChoreoIdpAuthModule;
