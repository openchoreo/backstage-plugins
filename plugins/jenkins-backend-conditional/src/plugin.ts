import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';

/**
 * Conditional Jenkins backend plugin that only initializes when Jenkins
 * configuration exists. This prevents startup failures when Jenkins is not
 * configured (e.g., when backstage.externalCI.jenkins.enabled=false in Helm).
 */
export const jenkinsBackendConditional = createBackendPlugin({
  pluginId: 'jenkins',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        permissions: coreServices.permissions,
        discovery: coreServices.discovery,
        catalog: catalogServiceRef,
      },
      async init({
        config,
        logger,
        httpRouter,
        auth,
        httpAuth,
        permissions,
        discovery,
        catalog,
      }) {
        const jenkinsBaseUrl = config.getOptionalString('jenkins.baseUrl');

        if (!jenkinsBaseUrl) {
          logger.info(
            'Jenkins backend disabled - no jenkins.baseUrl configuration found',
          );
          return;
        }

        // Dynamically import Jenkins components to build the router
        const { JenkinsBuilder, DefaultJenkinsInfoProvider } = await import(
          '@backstage-community/plugin-jenkins-backend'
        );

        const jenkinsInfoProvider = DefaultJenkinsInfoProvider.fromConfig({
          config,
          catalog,
          discovery,
          auth,
          httpAuth,
          logger,
        });

        const { router } = await JenkinsBuilder.createBuilder({
          config,
          logger,
          permissions,
          jenkinsInfoProvider,
          discovery,
          auth,
          httpAuth,
        }).build();

        httpRouter.use(router);
        logger.info('Jenkins backend plugin initialized');
      },
    });
  },
});
