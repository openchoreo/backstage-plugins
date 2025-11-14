import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { observabilityServiceRef } from './services/ObservabilityService';

/**
 * openchoreoObservabilityBackendPlugin backend plugin
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
        observabilityService: observabilityServiceRef,
      },
      async init({ httpAuth, httpRouter, observabilityService }) {
        httpRouter.use(
          await createRouter({
            httpAuth,
            observabilityService,
          }),
        );
      },
    });
  },
});
