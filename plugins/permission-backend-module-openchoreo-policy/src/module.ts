import { createBackendModule } from '@backstage/backend-plugin-api';
import { coreServices } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { OpenChoreoPermissionPolicy } from './policy';
import { AuthzProfileService, AuthzProfileCache } from './services';

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
 *   permission:
 *     enabled: true
 *     defaultOrg: my-org
 *     cache:
 *       ttlSeconds: 300
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
      },
      async init({ policy, config, logger, cache }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info(
            'OpenChoreo permission policy disabled - no openchoreo configuration found',
          );
          return;
        }

        const permissionConfig =
          openchoreoConfig.getOptionalConfig('permission');
        const enabled = permissionConfig?.getOptionalBoolean('enabled') ?? true;

        if (!enabled) {
          logger.info('OpenChoreo permission policy explicitly disabled');
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');
        const ttlSeconds =
          permissionConfig
            ?.getOptionalConfig('cache')
            ?.getOptionalNumber('ttlSeconds') ?? 300;

        // Create the cache for capabilities
        const authzCache = new AuthzProfileCache(cache, {
          defaultTtlMs: ttlSeconds * 1000,
        });

        // Create the authz profile service
        const authzService = new AuthzProfileService({
          baseUrl,
          logger,
          cache: authzCache,
        });

        // Create and register the policy
        const openchoreoPolicy = new OpenChoreoPermissionPolicy({
          authzService,
          config: openchoreoConfig,
          logger,
        });

        policy.setPolicy(openchoreoPolicy);

        logger.info('OpenChoreo permission policy registered successfully');
      },
    });
  },
});
