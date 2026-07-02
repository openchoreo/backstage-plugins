import {
  coreServices,
  createBackendModule,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
  catalogServiceRef,
} from '@backstage/plugin-catalog-node';
import { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
import { ScaffolderEntityProvider } from './provider/ScaffolderEntityProvider';
import {
  EnvironmentEntityProcessor,
  DataplaneEntityProcessor,
  WorkflowPlaneEntityProcessor,
  ObservabilityPlaneEntityProcessor,
  DeploymentPipelineEntityProcessor,
  ComponentEntityProcessor,
  ResourceEntityProcessor,
  ComponentTypeEntityProcessor,
  TraitTypeEntityProcessor,
  WorkflowEntityProcessor,
  CustomAnnotationProcessor,
  ClusterComponentTypeEntityProcessor,
  ClusterTraitTypeEntityProcessor,
  ClusterDataplaneEntityProcessor,
  ClusterObservabilityPlaneEntityProcessor,
  ClusterWorkflowPlaneEntityProcessor,
  ClusterWorkflowEntityProcessor,
  ClusterResourceTypeEntityProcessor,
  ResourceTypeEntityProcessor,
  ClusterProjectTypeEntityProcessor,
  ProjectTypeEntityProcessor,
  SystemEntityProcessor,
  ObservabilityAlertsNotificationChannelEntityProcessor,
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
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { OpenChoreoEventRouter } from './events/OpenChoreoEventRouter';

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
        permissionsRegistry: coreServices.permissionsRegistry,
        catalogService: catalogServiceRef,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        auth: coreServices.auth,
        tokenService: openChoreoTokenServiceRef,
        annotationStore: annotationStoreRef,
        events: eventsServiceRef,
      },
      async init({
        catalog,
        permissionsRegistry,
        catalogService,
        config,
        logger,
        scheduler,
        auth,
        tokenService,
        annotationStore,
        events,
      }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');
        const frequency =
          openchoreoConfig?.getOptionalNumber('schedule.frequency') ?? 300;
        const timeout =
          openchoreoConfig?.getOptionalNumber('schedule.timeout') ?? 120;
        // Whether to wire up the event-driven sync. Defaults to true so
        // local development still gets event-driven behaviour out of
        // the box. In production the Helm chart sets
        // `openchoreo.events.enabled` to mirror `eventForwarder.enabled`
        // so disabling the event-forwarder cleanly also disables the
        // Backstage event subscriptions (no router, no entity-provider
        // topic subscription, no HTTP topic in use).
        const eventsEnabled =
          openchoreoConfig?.getOptionalBoolean('events.enabled') ?? true;

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

        // Register the WorkflowPlane entity processor
        catalog.addProcessor(new WorkflowPlaneEntityProcessor());

        // Register the ObservabilityPlane entity processor
        catalog.addProcessor(new ObservabilityPlaneEntityProcessor());

        // Register the DeploymentPipeline entity processor
        catalog.addProcessor(new DeploymentPipelineEntityProcessor());

        // Register the Component entity processor (emits instanceOf relation to ComponentType)
        catalog.addProcessor(new ComponentEntityProcessor());

        // Register the Resource entity processor (emits instanceOf relation to (Cluster)ResourceType)
        catalog.addProcessor(new ResourceEntityProcessor());

        // Register the ComponentType entity processor
        catalog.addProcessor(new ComponentTypeEntityProcessor());

        // Register the TraitType entity processor
        catalog.addProcessor(new TraitTypeEntityProcessor());

        // Register the Workflow entity processor
        catalog.addProcessor(new WorkflowEntityProcessor());

        // Register the ClusterComponentType entity processor
        catalog.addProcessor(new ClusterComponentTypeEntityProcessor());

        // Register the ClusterTraitType entity processor
        catalog.addProcessor(new ClusterTraitTypeEntityProcessor());

        // Register the ClusterDataplane entity processor
        catalog.addProcessor(new ClusterDataplaneEntityProcessor());

        // Register the ClusterObservabilityPlane entity processor
        catalog.addProcessor(new ClusterObservabilityPlaneEntityProcessor());

        // Register the ClusterWorkflowPlane entity processor
        catalog.addProcessor(new ClusterWorkflowPlaneEntityProcessor());

        // Register the ClusterWorkflow entity processor
        catalog.addProcessor(new ClusterWorkflowEntityProcessor());

        // Register the ClusterResourceType entity processor
        catalog.addProcessor(new ClusterResourceTypeEntityProcessor());

        // Register the ResourceType entity processor
        catalog.addProcessor(new ResourceTypeEntityProcessor());

        // Register the ClusterProjectType entity processor
        catalog.addProcessor(new ClusterProjectTypeEntityProcessor());

        // Register the ProjectType entity processor
        catalog.addProcessor(new ProjectTypeEntityProcessor());

        // Register the System (Project) entity processor.
        // Emits the usesPipeline / pipelineUsedBy relation pair from the
        // Project side using `System.spec.deploymentPipelineRef`.
        catalog.addProcessor(new SystemEntityProcessor());

        // Register the ObservabilityAlertsNotificationChannel entity processor
        catalog.addProcessor(
          new ObservabilityAlertsNotificationChannelEntityProcessor(),
        );

        // Wire the OpenChoreo event-driven flow only when enabled. When
        // disabled the entity provider falls back to poll-only mode
        // driven by `schedule.frequency` (operators may want to lower
        // that frequency in this case).
        if (eventsEnabled) {
          const eventRouter = new OpenChoreoEventRouter({ events });
          await eventRouter.subscribe();
        } else {
          logger.info(
            'OpenChoreo event-driven sync disabled (openchoreo.events.enabled=false); running in poll-only mode',
          );
        }

        // Register the scheduled OpenChoreo entity provider. When
        // events are disabled we pass `undefined` so the provider's
        // `connect()` skips its event subscriptions.
        catalog.addEntityProvider(
          new OpenChoreoEntityProvider(
            taskRunner,
            logger,
            config,
            tokenService,
            eventsEnabled ? events : undefined,
            catalogService,
            auth,
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

        // Register OpenChoreo permission rule for catalog entities.
        // v1.51 `addPermissionRules` types its arg as
        // `PermissionRule<any, any, string>[]` (3 generics) while
        // `createPermissionRule` returns the more specific 4-generic
        // shape. Widening cast — the runtime contract is identical.
        permissionsRegistry.addPermissionRules([
          matchesCatalogEntityCapability as any,
        ]);
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
