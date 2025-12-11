import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { observabilityServiceRef } from './services/ObservabilityService';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';

/**
 * openchoreoObservabilityBackendPlugin backend plugin
 *
 * This plugin checks the openchoreo.features.observability.enabled config flag.
 * When disabled (false), the plugin skips initialization and no routes are registered.
 *
 * @public
 */
export const openchoreoObservabilityBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-observability-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        observabilityService: observabilityServiceRef,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({
        httpAuth,
        httpRouter,
        logger,
        config,
        observabilityService,
        tokenService,
      }) {
        // Check if observability feature is enabled (defaults to true)
        const observabilityEnabled =
          config.getOptionalBoolean(
            'openchoreo.features.observability.enabled',
          ) ?? true;

        if (!observabilityEnabled) {
          logger.info(
            'OpenChoreo observability backend disabled via openchoreo.features.observability.enabled=false',
          );
          return;
        }

        // Check if auth feature is enabled (defaults to true)
        // When auth is disabled, httpAuth checks are skipped to allow guest access
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        httpRouter.use(
          await createRouter({
            httpAuth,
            observabilityService,
            tokenService,
            authEnabled,
          }),
        );
      },
    });
  },
});
