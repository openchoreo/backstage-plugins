import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import { createRouter } from './router';
import { ImageSecurityService } from './services/ImageSecurityService';
import { loadPublicKey } from './services/attestation';

/**
 * OpenChoreo Image Security Backend Plugin
 *
 * Reports, per component and environment, the vulnerability scan attached to
 * the running image as a signed cosign attestation (for example by the
 * openchoreo-image-security build steps).
 *
 * @public
 */
export const openchoreoImageSecurityBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-image-security-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ httpRouter, logger, config, tokenService }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');
        const securityConfig =
          openchoreoConfig?.getOptionalConfig('imageSecurity');
        if (!openchoreoConfig || !securityConfig) {
          logger.info(
            'OpenChoreo image security backend plugin disabled - no openchoreo.imageSecurity configuration',
          );
          return;
        }

        const publicKeyPem = securityConfig.getOptionalString('publicKey');
        if (!publicKeyPem) {
          logger.warn(
            'openchoreo.imageSecurity.publicKey is not set; scan results are shown as unverified',
          );
        }

        const imageSecurityService = new ImageSecurityService(logger, {
          baseUrl: openchoreoConfig.getString('baseUrl'),
          publicKey: publicKeyPem ? loadPublicKey(publicKeyPem) : undefined,
          severities: securityConfig.getOptionalStringArray('severities') ?? [
            'CRITICAL',
            'HIGH',
          ],
          cacheTtlSeconds:
            securityConfig.getOptionalNumber('cacheTtlSeconds') ?? 300,
          registries: (
            securityConfig.getOptionalConfigArray('registries') ?? []
          ).map(r => ({
            host: r.getString('host'),
            url: r.getOptionalString('url'),
            username: r.getOptionalString('username'),
            password: r.getOptionalString('password'),
            tokenRealm: r.getOptionalString('tokenRealm'),
          })),
        });

        httpRouter.use(
          await createRouter({ imageSecurityService, tokenService }),
        );
      },
    });
  },
});
