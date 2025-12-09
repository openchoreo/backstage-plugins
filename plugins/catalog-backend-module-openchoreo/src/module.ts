import {
  coreServices,
  createBackendModule,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
import { ScaffolderEntityProvider } from './provider/ScaffolderEntityProvider';
import {
  EnvironmentEntityProcessor,
  DataplaneEntityProcessor,
} from './processors';
import {
  immediateCatalogServiceRef,
  ImmediateCatalogService,
} from './service/ImmediateCatalogService';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';

// Singleton instance of the ScaffolderEntityProvider
// This will be shared across the module and the service
let scaffolderProviderInstance: ScaffolderEntityProvider | undefined;

/**
 * OpenChoreo catalog backend module
 *
 * @public
 */
export const catalogModuleOpenchoreo = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'openchoreo',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ catalog, config, logger, scheduler, tokenService }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');
        const frequency =
          openchoreoConfig?.getOptionalNumber('schedule.frequency') ?? 30;
        const timeout =
          openchoreoConfig?.getOptionalNumber('schedule.timeout') ?? 120;

        const taskRunner = scheduler.createScheduledTaskRunner({
          frequency: { seconds: frequency },
          timeout: { seconds: timeout },
        });

        // Register the Environment entity processor
        catalog.addProcessor(new EnvironmentEntityProcessor());

        // Register the Dataplane entity processor
        catalog.addProcessor(new DataplaneEntityProcessor());

        // Register the scheduled OpenChoreo entity provider
        catalog.addEntityProvider(
          new OpenChoreoEntityProvider(
            taskRunner,
            logger,
            config,
            tokenService,
          ),
        );

        // Create and register the ScaffolderEntityProvider for immediate insertions
        // Pass 'OpenChoreoEntityProvider' so it uses the same location key bucket
        if (!scaffolderProviderInstance) {
          scaffolderProviderInstance = new ScaffolderEntityProvider(
            logger,
            'OpenChoreoEntityProvider',
          );
        }
        catalog.addEntityProvider(scaffolderProviderInstance);
      },
    });
  },
});

/**
 * Factory for the ImmediateCatalogService.
 * This creates and provides the service instance that can be used by other modules.
 */
export const immediateCatalogServiceFactory = createServiceFactory({
  service: immediateCatalogServiceRef,
  deps: {
    logger: coreServices.logger,
  },
  async factory({ logger }): Promise<ImmediateCatalogService> {
    // Ensure singleton instance exists
    if (!scaffolderProviderInstance) {
      scaffolderProviderInstance = new ScaffolderEntityProvider(
        logger,
        'OpenChoreoEntityProvider',
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
