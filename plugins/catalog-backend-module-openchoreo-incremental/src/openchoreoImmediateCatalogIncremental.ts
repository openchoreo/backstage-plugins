import {
  coreServices,
  createBackendModule,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import {
  immediateCatalogServiceRef,
  ScaffolderEntityProvider,
  type ImmediateCatalogService,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

let scaffolderProviderInstance: ScaffolderEntityProvider | undefined;

const MAIN_INCREMENTAL_PROVIDER_NAME = 'OpenChoreoIncrementalEntityProvider';

/**
 * Adds a catalog entity provider that supports immediate delta mutations.
 *
 * This is intended to be used together with the OpenChoreo incremental ingestion provider,
 * without enabling the legacy scheduled OpenChoreo provider.
 */
export const catalogModuleOpenchoreoImmediateCatalogIncremental =
  createBackendModule({
    pluginId: 'catalog',
    moduleId: 'openchoreo-immediate-catalog-incremental',
    register(env) {
      env.registerInit({
        deps: {
          catalog: catalogProcessingExtensionPoint,
          logger: coreServices.logger,
        },
        async init({ catalog, logger }) {
          if (!scaffolderProviderInstance) {
            scaffolderProviderInstance = new ScaffolderEntityProvider(
              logger,
              MAIN_INCREMENTAL_PROVIDER_NAME,
            );
          }

          catalog.addEntityProvider(scaffolderProviderInstance);
        },
      });
    },
  });

/**
 * Provides the `openchoreo.immediate-catalog` service used by OpenChoreo scaffolder actions.
 */
export const openchoreoImmediateCatalogIncrementalServiceFactory =
  createServiceFactory({
    service: immediateCatalogServiceRef,
    deps: {
      logger: coreServices.logger,
    },
    async factory({ logger }): Promise<ImmediateCatalogService> {
      if (!scaffolderProviderInstance) {
        scaffolderProviderInstance = new ScaffolderEntityProvider(
          logger,
          MAIN_INCREMENTAL_PROVIDER_NAME,
        );
      }

      return {
        insertEntity: async entity =>
          scaffolderProviderInstance!.insertEntity(entity),
        removeEntity: async entityRef =>
          scaffolderProviderInstance!.removeEntity(entityRef),
      };
    },
  });
