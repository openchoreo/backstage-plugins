import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { PlatformEnvironmentInfoService } from './services/PlatformEnvironmentService';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';

/**
 * platformEngineerCorePlugin backend plugin
 *
 * @public
 */
export const platformEngineerCorePlugin = createBackendPlugin({
  pluginId: 'platform-engineer-core',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ logger, config, httpRouter, tokenService }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info(
            'Platform Engineer Core plugin disabled - no OpenChoreo configuration found',
          );
          return;
        }

        const platformEnvironmentService = new PlatformEnvironmentInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        httpRouter.use(
          await createRouter({
            platformEnvironmentService,
            tokenService,
          }),
        );

        logger.info('Platform Engineer Core backend plugin initialized');
      },
    });
  },
});
