import {
  createBackendFeatureLoader,
  coreServices,
} from '@backstage/backend-plugin-api';

/**
 * SonarQube backend feature loader.
 * Conditionally registers the SonarQube plugin only if 'sonarqube' config is present.
 */
export const conditionalSonarQube = createBackendFeatureLoader({
  deps: {
    config: coreServices.rootConfig,
    logger: coreServices.rootLogger,
  },
  *loader({ config, logger }) {
    if (config.getOptionalConfig('sonarqube')) {
      // Use require() instead of import() to avoid ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG in Jest
      const plugin = require('@backstage-community/plugin-sonarqube-backend');
      yield plugin.default || plugin;
    } else {
      logger.info(
        'SonarQube configuration is missing, skipping plugin-sonarqube-backend registration.',
      );
    }
  },
});
