import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import { WorkflowService } from './services/WorkflowService';

/**
 * OpenChoreo CI Backend Plugin
 *
 * This plugin provides backend APIs for CI/Workflow functionality:
 * - Fetching workflow runs and their details
 * - Triggering builds
 * - Managing workflow configuration/parameters
 * - Fetching build logs
 *
 * @public
 */
export const openchoreoCiBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-ci-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ httpRouter, logger, config, tokenService }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info(
            'OpenChoreo CI backend plugin disabled - no configuration found',
          );
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');

        // Check if auth feature is enabled (defaults to true)
        // When auth is enabled, mutating operations require a valid user token
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        logger.info('Initializing OpenChoreo CI backend plugin');

        // Initialize service
        const workflowService = new WorkflowService(logger, baseUrl);

        httpRouter.use(
          await createRouter({
            workflowService,
            tokenService,
            authEnabled,
          }),
        );
      },
    });
  },
});
