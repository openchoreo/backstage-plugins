import {
  coreServices,
  createBackendModule,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
  catalogPermissionExtensionPoint,
} from '@backstage/plugin-catalog-node/alpha';
import { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
import { ScaffolderEntityProvider } from './provider/ScaffolderEntityProvider';
import {
  EnvironmentEntityProcessor,
  DataplaneEntityProcessor,
  BuildPlaneEntityProcessor,
  ObservabilityPlaneEntityProcessor,
  DeploymentPipelineEntityProcessor,
  ComponentEntityProcessor,
  ComponentTypeEntityProcessor,
  TraitTypeEntityProcessor,
  WorkflowEntityProcessor,
  ComponentWorkflowEntityProcessor,
  CustomAnnotationProcessor,
  ClusterComponentTypeEntityProcessor,
  ClusterTraitTypeEntityProcessor,
  ClusterDataplaneEntityProcessor,
  ClusterObservabilityPlaneEntityProcessor,
  ClusterBuildPlaneEntityProcessor,
  SystemBuildPlaneProcessor,
} from './processors';
import {
  immediateCatalogServiceRef,
  ImmediateCatalogService,
} from './service/ImmediateCatalogService';
import {
  annotationStoreRef,
  AnnotationStore,
  DatabaseAnnotationStore,
  applyAnnotationStoreMigrations,
} from './service/AnnotationStore';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import { matchesCatalogEntityCapability } from '@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy';

// Singleton instance of the ScaffolderEntityProvider
// This will be shared across the module and the service
let scaffolderProviderInstance: ScaffolderEntityProvider | undefined;

// Singleton promise for the AnnotationStore
// Shared between the catalog module (processor) and the service factory (API routes)
// Using a promise ensures concurrent factory calls (from multiple plugins) all await
// the same initialization — preventing duplicate migration runs.
let annotationStorePromise: Promise<AnnotationStore> | undefined;

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
        catalogPermissions: catalogPermissionExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        tokenService: openChoreoTokenServiceRef,
        annotationStore: annotationStoreRef,
      },
      async init({
        catalog,
        catalogPermissions,
        config,
        logger,
        scheduler,
        tokenService,
        annotationStore,
      }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');
        const frequency =
          openchoreoConfig?.getOptionalNumber('schedule.frequency') ?? 30;
        const timeout =
          openchoreoConfig?.getOptionalNumber('schedule.timeout') ?? 120;

        const taskRunner = scheduler.createScheduledTaskRunner({
          frequency: { seconds: frequency },
          timeout: { seconds: timeout },
        });

        // Register the custom annotation processor (merges user-defined annotations)
        // Uses the shared annotation store from the factory
        catalog.addProcessor(new CustomAnnotationProcessor(annotationStore));

        // Register the Environment entity processor
        catalog.addProcessor(new EnvironmentEntityProcessor());

        // Register the Dataplane entity processor
        catalog.addProcessor(new DataplaneEntityProcessor());

        // Register the BuildPlane entity processor
        catalog.addProcessor(new BuildPlaneEntityProcessor());

        // Register the ObservabilityPlane entity processor
        catalog.addProcessor(new ObservabilityPlaneEntityProcessor());

        // Register the DeploymentPipeline entity processor
        catalog.addProcessor(new DeploymentPipelineEntityProcessor());

        // Register the Component entity processor (emits instanceOf relation to ComponentType)
        catalog.addProcessor(new ComponentEntityProcessor());

        // Register the ComponentType entity processor
        catalog.addProcessor(new ComponentTypeEntityProcessor());

        // Register the TraitType entity processor
        catalog.addProcessor(new TraitTypeEntityProcessor());

        // Register the Workflow entity processor
        catalog.addProcessor(new WorkflowEntityProcessor());

        // Register the ComponentWorkflow entity processor
        catalog.addProcessor(new ComponentWorkflowEntityProcessor());

        // Register the ClusterComponentType entity processor
        catalog.addProcessor(new ClusterComponentTypeEntityProcessor());

        // Register the ClusterTraitType entity processor
        catalog.addProcessor(new ClusterTraitTypeEntityProcessor());

        // Register the ClusterDataplane entity processor
        catalog.addProcessor(new ClusterDataplaneEntityProcessor());

        // Register the ClusterObservabilityPlane entity processor
        catalog.addProcessor(new ClusterObservabilityPlaneEntityProcessor());

        // Register the ClusterBuildPlane entity processor
        catalog.addProcessor(new ClusterBuildPlaneEntityProcessor());

        // Register the SystemBuildPlane processor (emits buildsOn/builds relations)
        catalog.addProcessor(new SystemBuildPlaneProcessor());

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

        // Register OpenChoreo permission rule for catalog entities
        // This allows catalog.entity.* permissions to be checked against OpenChoreo capabilities
        catalogPermissions.addPermissionRules(matchesCatalogEntityCapability);
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

/**
 * Factory for the AnnotationStore.
 * Provides the annotation store service to other plugins (e.g., openchoreo-backend).
 *
 * IMPORTANT: This factory explicitly uses the 'catalog' plugin's database to ensure
 * all plugins share the same annotation data. The catalog module also depends on
 * this service, creating a shared instance.
 */
export const annotationStoreFactory = createServiceFactory({
  service: annotationStoreRef,
  deps: {
    rootConfig: coreServices.rootConfig,
    logger: coreServices.logger,
    lifecycle: coreServices.rootLifecycle,
  },
  async factory({ rootConfig, logger, lifecycle }): Promise<AnnotationStore> {
    if (!annotationStorePromise) {
      annotationStorePromise = (async () => {
        // Use DatabaseManager to explicitly get the catalog plugin's database
        const { DatabaseManager } = await import(
          '@backstage/backend-defaults/database'
        );
        const databaseManager = DatabaseManager.fromConfig(rootConfig);
        const catalogDb = databaseManager.forPlugin('catalog', {
          logger,
          lifecycle,
        });
        const knex = await catalogDb.getClient();

        await applyAnnotationStoreMigrations(knex, logger);
        return new DatabaseAnnotationStore(knex);
      })();
    }
    return annotationStorePromise;
  },
});
