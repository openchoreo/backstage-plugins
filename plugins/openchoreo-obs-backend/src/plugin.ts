import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { obsServiceRef } from './services/ObsService';

/**
 * openchoreoObservabilityBackendPlugin backend plugin
 *
 * @public
 */
export const openchoreoObservabilityBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-obs-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        obsService: obsServiceRef,
      },
      async init({ httpAuth, httpRouter, obsService }) {
        httpRouter.use(
          await createRouter({
            httpAuth,
            obsService,
          }),
        );
      },
    });
  },
});
