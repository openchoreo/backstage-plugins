import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import { GenericWorkflowService } from './services/GenericWorkflowService';

/**
 * OpenChoreo Generic Workflows Backend Plugin
 *
 * This plugin provides backend APIs for org-level generic workflows:
 * - Listing workflow templates
 * - Getting workflow schemas for dynamic form generation
 * - Listing workflow runs
 * - Getting workflow run details
 * - Triggering new workflow runs
 *
 * @public
 */
export const openchoreoWorkflowsBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-workflows-backend',
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
            'OpenChoreo Workflows backend plugin disabled - no configuration found',
          );
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');

        // Check if auth feature is enabled (defaults to true)
        // When auth is enabled, mutating operations require a valid user token
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        logger.info('Initializing OpenChoreo Workflows backend plugin');

        // Initialize service
        const workflowService = new GenericWorkflowService(logger, baseUrl);

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
