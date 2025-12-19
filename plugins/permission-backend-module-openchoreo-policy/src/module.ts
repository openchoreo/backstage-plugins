import { createBackendModule } from '@backstage/backend-plugin-api';
import { coreServices } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { OpenChoreoPermissionPolicy } from './policy';
import { AuthzProfileService, AuthzProfileCache } from './services';
import { createRouter } from './router';

/**
 * OpenChoreo permission policy backend module.
 *
 * This module integrates the OpenChoreo authorization system with Backstage's
 * permission framework. When installed, it replaces the default permission policy
 * with one that queries the OpenChoreo /authz/profile API for authorization decisions.
 *
 * @example
 * ```typescript
 * // In packages/backend/src/index.ts
 * import { createBackend } from '@backstage/backend-defaults';
 *
 * const backend = createBackend();
 * backend.add(import('@backstage/plugin-permission-backend'));
 * backend.add(import('@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy'));
 * backend.start();
 * ```
 *
 * @example
 * ```yaml
 * # In app-config.yaml
 * openchoreo:
 *   baseUrl: http://api.openchoreo.localhost:8080/api/v1
 *   features:
 *     authz:
 *       enabled: true
 * ```
 */
export const permissionModuleOpenChoreoPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'openchoreo-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        policy: policyExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        cache: coreServices.cache,
        httpRouter: coreServices.httpRouter,
      },
      async init({ policy, config, logger, cache, httpRouter }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info(
            'OpenChoreo permission policy disabled - no openchoreo configuration found',
          );
          return;
        }

        const authzEnabled =
          openchoreoConfig.getOptionalBoolean('features.authz.enabled') ?? true;

        if (!authzEnabled) {
          logger.info(
            'OpenChoreo permission policy disabled via openchoreo.features.authz.enabled=false',
          );
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');

        // Create the cache for capabilities (TTL derived from token expiration)
        const authzCache = new AuthzProfileCache(cache);

        // Create the authz profile service
        const authzService = new AuthzProfileService({
          baseUrl,
          logger,
          cache: authzCache,
        });

        // Create and register the policy
        const openchoreoPolicy = new OpenChoreoPermissionPolicy({
          authzService,
          logger,
        });

        policy.setPolicy(openchoreoPolicy);

        // Register the router for internal endpoints (e.g., cache-capabilities)
        httpRouter.use(
          await createRouter({
            authzService,
            logger,
          }),
        );

        logger.info('OpenChoreo permission policy registered successfully');
      },
    });
  },
});
