import {
  CatalogService,
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import {
  AuthService,
  LoggerService,
  SchedulerServiceTaskRunner,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import type { EventsService, EventParams } from '@backstage/plugin-events-node';
import {
  fetchAllPages,
  getCreatedAt,
  getDescription,
  getDisplayName,
  getName,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';
import { DeploymentPipelineEntityV1alpha1 } from '../kinds';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import { RtdToTemplateConverter } from '../converters/RtdToTemplateConverter';
import {
  PtdToTemplateConverter,
  ProjectTypeCRD,
} from '../converters/PtdToTemplateConverter';
import { ComponentWorkloadData } from '../utils/types';
import {
  buildComponentDependsOnRefs,
  createApiEntitiesFromNewWorkload,
  extractAllWorkloadEndpoints,
  extractSchemaEndpoints,
  extractWorkloadDependencies,
  extractWorkloadResourceDependencies,
  filterDependenciesWithSchema,
  resolveComponentOwner,
  resolveProvidesAndConsumes,
} from '../utils/helpers';
import {
  NewApiTranslatorContext,
  translateNewClusterComponentTypeToEntity,
  translateNewClusterResourceTypeToEntity,
  translateNewClusterDataplaneToEntity,
  translateNewClusterObservabilityPlaneToEntity,
  translateNewClusterTraitToEntity,
  translateNewClusterWorkflowPlaneToEntity,
  translateNewClusterWorkflowToEntity,
  translateNewComponentToEntity,
  translateNewComponentTypeToEntity,
  translateNewDataplaneToEntity,
  translateNewDeploymentPipelineToEntity,
  translateNewEnvironmentToEntity,
  translateNewNotificationChannelToEntity,
  translateNewNamespaceToDomainEntity,
  translateNewObservabilityPlaneToEntity,
  translateNewProjectToEntity,
  translateNewClusterProjectTypeToEntity,
  translateNewProjectTypeToEntity,
  translateNewResourceToEntity,
  translateNewResourceTypeToEntity,
  translateNewTraitToEntity,
  translateNewWorkflowPlaneToEntity,
  translateNewWorkflowToEntity,
} from '../utils/entityTranslation';
import { createAuthenticatedOpenChoreoApiClient } from '../utils/openChoreoApiClient';
import { EventDeltaApplier } from './EventDeltaApplier';

// Lightweight aliases used inside runNew. The full new-API type set lives
// in utils/types.ts and utils/entityTranslation.ts.
type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];
type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];
type NewEnvironment = OpenChoreoComponents['schemas']['Environment'];
type NewNotificationChannel =
  OpenChoreoComponents['schemas']['ObservabilityAlertsNotificationChannel'];
type NewDataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type NewWorkflowPlane = OpenChoreoComponents['schemas']['WorkflowPlane'];
type NewObservabilityPlane =
  OpenChoreoComponents['schemas']['ObservabilityPlane'];
type NewDeploymentPipeline =
  OpenChoreoComponents['schemas']['DeploymentPipeline'];
type NewComponentType = OpenChoreoComponents['schemas']['ComponentType'];
type NewResourceType = OpenChoreoComponents['schemas']['ResourceType'];
type NewProjectType = OpenChoreoComponents['schemas']['ProjectType'];
type NewClusterProjectType =
  OpenChoreoComponents['schemas']['ClusterProjectType'];
type NewResource = OpenChoreoComponents['schemas']['ResourceInstance'];
type NewTrait = OpenChoreoComponents['schemas']['Trait'];
type NewClusterComponentType =
  OpenChoreoComponents['schemas']['ClusterComponentType'];
type NewClusterResourceType =
  OpenChoreoComponents['schemas']['ClusterResourceType'];
type NewClusterTrait = OpenChoreoComponents['schemas']['ClusterTrait'];
type NewClusterDataPlane = OpenChoreoComponents['schemas']['ClusterDataPlane'];
type NewClusterObservabilityPlane =
  OpenChoreoComponents['schemas']['ClusterObservabilityPlane'];
type NewClusterWorkflowPlane =
  OpenChoreoComponents['schemas']['ClusterWorkflowPlane'];
type NewClusterWorkflow = OpenChoreoComponents['schemas']['ClusterWorkflow'];
type NewWorkflow = OpenChoreoComponents['schemas']['Workflow'];

/**
 * Provides entities from OpenChoreo API
 */
export class OpenChoreoEntityProvider implements EntityProvider {
  private readonly taskRunner: SchedulerServiceTaskRunner;
  private connection?: EntityProviderConnection;
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly defaultOwner: string;
  private readonly ctdConverter: CtdToTemplateConverter;
  private readonly rtdConverter: RtdToTemplateConverter;
  private readonly ptdConverter: PtdToTemplateConverter;
  private readonly componentTypeUtils: ComponentTypeUtils;
  private readonly tokenService?: OpenChoreoTokenService;
  private readonly events?: EventsService;
  /** Context shared with the New-API translator functions. Built once. */
  private readonly translatorContext: NewApiTranslatorContext;
  /** Subsystem that handles per-event delta updates. Built once. */
  private readonly eventApplier: EventDeltaApplier;

  constructor(
    taskRunner: SchedulerServiceTaskRunner,
    logger: LoggerService,
    config: Config,
    tokenService?: OpenChoreoTokenService,
    events?: EventsService,
    catalogService?: CatalogService,
    auth?: AuthService,
  ) {
    this.taskRunner = taskRunner;
    this.logger = logger;
    this.baseUrl = config.getString('openchoreo.baseUrl');
    this.tokenService = tokenService;
    this.events = events;
    // Default owner for built-in Backstage entities (Domain, System, Component, API)
    // These kinds require owner field per Backstage schema validation
    const ownerName =
      config.getOptionalString('openchoreo.defaultOwner') || 'openchoreo-users';
    // Qualify with 'default' namespace so owner resolves correctly for entities in non-default namespaces
    this.defaultOwner = `group:default/${ownerName}`;
    // Initialize CTD to Template converter
    this.ctdConverter = new CtdToTemplateConverter({
      defaultOwner: this.defaultOwner,
    });
    // Initialize RTD to Template converter — generates per-type Resource
    // wizards from (Cluster)ResourceType entities.
    this.rtdConverter = new RtdToTemplateConverter({
      defaultOwner: this.defaultOwner,
    });
    // Initialize PTD to Template converter — generates per-type Project
    // wizards from (Cluster)ProjectType entities.
    this.ptdConverter = new PtdToTemplateConverter({
      defaultOwner: this.defaultOwner,
    });
    // Initialize component type utilities from config
    this.componentTypeUtils = ComponentTypeUtils.fromConfig(config);

    this.translatorContext = {
      providerName: this.getProviderName(),
      defaultOwner: this.defaultOwner,
      componentTypeUtils: this.componentTypeUtils,
    };

    this.eventApplier = new EventDeltaApplier({
      logger: this.logger,
      baseUrl: this.baseUrl,
      tokenService: this.tokenService,
      defaultOwner: this.defaultOwner,
      translatorContext: this.translatorContext,
      getConnection: () => this.connection,
      ctdConverter: this.ctdConverter,
      rtdConverter: this.rtdConverter,
      ptdConverter: this.ptdConverter,
      catalogService,
      auth,
    });
  }

  getProviderName(): string {
    return 'OpenChoreoEntityProvider';
  }

  /**
   * Map a fetched (Cluster)ProjectType list item to the `ProjectTypeCRD` shape
   * consumed by `PtdToTemplateConverter`. The list endpoint returns the full
   * `spec.parameters.openAPIV3Schema` inline, so no extra fetch is required.
   */
  private toProjectTypeCRD(
    pt: NewProjectType | NewClusterProjectType,
  ): ProjectTypeCRD {
    return {
      metadata: {
        name: getName(pt)!,
        displayName: getDisplayName(pt),
        description: getDescription(pt),
        createdAt: getCreatedAt(pt) || '',
      },
      spec: {
        parameters: pt.spec?.parameters?.openAPIV3Schema
          ? { openAPIV3Schema: pt.spec.parameters.openAPIV3Schema as any }
          : undefined,
      },
    };
  }

  /** Stamp the provider's managed-by-location annotations on a generated entity. */
  private stampManagedByLocation(entity: Entity): void {
    if (!entity.metadata.annotations) {
      entity.metadata.annotations = {};
    }
    entity.metadata.annotations[
      'backstage.io/managed-by-location'
    ] = `provider:${this.getProviderName()}`;
    entity.metadata.annotations[
      'backstage.io/managed-by-origin-location'
    ] = `provider:${this.getProviderName()}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;

    // Subscribe to OpenChoreo events for delta updates
    if (this.events) {
      await this.events.subscribe({
        id: 'OpenChoreoEntityProvider',
        topics: [
          'openchoreo.namespace',
          'openchoreo.project',
          'openchoreo.component',
          'openchoreo.environment',
          'openchoreo.observabilityalertsnotificationchannel',
          'openchoreo.dataplane',
          'openchoreo.workflowplane',
          'openchoreo.observabilityplane',
          'openchoreo.deploymentpipeline',
          'openchoreo.componenttype',
          'openchoreo.resourcetype',
          'openchoreo.projecttype',
          'openchoreo.resource',
          'openchoreo.trait',
          'openchoreo.workflow',
          'openchoreo.workload',
          'openchoreo.clustercomponenttype',
          'openchoreo.clusterresourcetype',
          'openchoreo.clusterprojecttype',
          'openchoreo.clustertrait',
          'openchoreo.clusterworkflow',
          'openchoreo.clusterdataplane',
          'openchoreo.clusterobservabilityplane',
          'openchoreo.clusterworkflowplane',
        ],
        onEvent: params => this.onEvent(params),
      });
      this.logger.info(
        'Subscribed to OpenChoreo events for delta catalog updates',
      );
    }

    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.run();
      },
    });
  }

  /**
   * Handles an incoming OpenChoreo event and applies a delta mutation.
   * For `deleted` events, the entity is removed from the catalog.
   * For `created`/`updated` events, the resource is re-fetched from the
   * OpenChoreo REST API and upserted into the catalog.
   */
  private async onEvent(params: EventParams): Promise<void> {
    if (!this.connection) {
      this.logger.warn('Event received before connection was initialized');
      return;
    }

    // Guard against non-object payloads (null, string, number, …) before
    // destructuring. Without this the destructure would throw, surfacing
    // as an unhandled rejection in the EventsService subscriber callback
    // rather than being absorbed by the per-event try/catch below.
    const rawPayload = params.eventPayload;
    if (
      rawPayload === null ||
      rawPayload === undefined ||
      typeof rawPayload !== 'object' ||
      Array.isArray(rawPayload)
    ) {
      this.logger.warn(
        `Ignoring OpenChoreo event with non-object payload: ${typeof rawPayload}`,
      );
      return;
    }

    const payload = rawPayload as {
      kind?: string;
      name?: string;
      namespace?: string;
      action?: string;
    };
    const { kind, name, namespace, action } = payload;

    if (!kind || !name || !action) {
      this.logger.warn(
        `Ignoring malformed OpenChoreo event: ${JSON.stringify(payload)}`,
      );
      return;
    }

    // Per-event chatter — debug only. The corresponding mutation
    // outcome is logged at info from EventDeltaApplier when a state
    // change actually lands.
    this.logger.debug(
      `Received OpenChoreo event: ${action} ${kind} ${
        namespace ? `${namespace}/` : ''
      }${name}`,
    );

    try {
      // Per-event delta path: fetch only the affected resource(s) and
      // apply a delta mutation. The same translators and processors are
      // used as the periodic full sync, so both paths converge to the
      // same catalog state. The 15-min poll is the safety net for any
      // missed events.
      await this.eventApplier.handleEvent(kind, name, namespace, action);
    } catch (error) {
      this.logger.error(
        `Failed to handle OpenChoreo event for ${kind}/${name}: ${error}`,
      );
    }
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    return this.runNew();
  }

  private async runNew(): Promise<void> {
    try {
      this.logger.info(
        'Fetching namespaces and projects from OpenChoreo API (new API)',
      );

      // Token-aware client; same factory used by EventDeltaApplier so the
      // periodic and event-driven paths talk to the API identically.
      const client = await createAuthenticatedOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        tokenService: this.tokenService,
      });

      // Fetch all namespaces
      const namespaces = await fetchAllPages<NewNamespace>(cursor =>
        client
          .GET('/api/v1/namespaces', {
            params: { query: { limit: 100, cursor } },
          })
          .then(res => {
            if (res.error) {
              const msg =
                typeof res.error === 'object' &&
                res.error !== null &&
                'message' in res.error
                  ? (res.error as { message: string }).message
                  : JSON.stringify(res.error);
              throw new Error(
                `Failed to fetch namespaces: ${res.response.status} ${res.response.statusText} - ${msg}`,
              );
            }
            return res.data;
          }),
      );

      this.logger.debug(
        `Found ${namespaces.length} namespaces from OpenChoreo`,
      );

      const allEntities: Entity[] = [];

      // Create Domain entities for each namespace
      const domainEntities: Entity[] = namespaces.map(ns =>
        translateNewNamespaceToDomainEntity(
          ns as NewNamespace,
          this.translatorContext,
        ),
      );
      allEntities.push(...domainEntities);

      // Get environments for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const environments = await fetchAllPages<NewEnvironment>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/environments', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch environments for ${nsName}`);
                return res.data;
              }),
          );

          const environmentEntities: Entity[] = environments.map(env =>
            translateNewEnvironmentToEntity(
              env,
              nsName,
              this.translatorContext,
            ),
          );
          allEntities.push(...environmentEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch environments for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get notification channels for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const notificationChannels =
            await fetchAllPages<NewNotificationChannel>(cursor =>
              client
                .GET(
                  '/api/v1/namespaces/{namespaceName}/observabilityalertsnotificationchannels',
                  {
                    params: {
                      path: { namespaceName: nsName },
                      query: { limit: 100, cursor },
                    },
                  },
                )
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch notification channels for ${nsName}`,
                    );
                  return res.data;
                }),
            );

          const notificationChannelEntities: Entity[] =
            notificationChannels.map(channel =>
              translateNewNotificationChannelToEntity(
                channel,
                nsName,
                this.translatorContext,
              ),
            );
          allEntities.push(...notificationChannelEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch notification channels for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get dataplanes for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const dataplanes = await fetchAllPages<NewDataPlane>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/dataplanes', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch dataplanes for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${dataplanes.length} dataplanes in namespace: ${nsName}`,
          );

          const dataplaneEntities: Entity[] = dataplanes.map(dp =>
            translateNewDataplaneToEntity(dp, nsName, this.translatorContext),
          );
          allEntities.push(...dataplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch dataplanes for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get workflowplanes for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const workflowplanes = await fetchAllPages<NewWorkflowPlane>(() =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/workflowplanes', {
                params: {
                  path: { namespaceName: nsName },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch workflowplanes for ${nsName}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${workflowplanes.length} workflowplanes in namespace: ${nsName}`,
          );

          const workflowplaneEntities: Entity[] = workflowplanes.map(bp =>
            translateNewWorkflowPlaneToEntity(
              bp,
              nsName,
              this.translatorContext,
            ),
          );
          allEntities.push(...workflowplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch workflowplanes for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get observabilityplanes for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const observabilityplanes =
            await fetchAllPages<NewObservabilityPlane>(() =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/observabilityplanes', {
                  params: {
                    path: { namespaceName: nsName },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch observabilityplanes for ${nsName}`,
                    );
                  return res.data;
                }),
            );

          this.logger.debug(
            `Found ${observabilityplanes.length} observabilityplanes in namespace: ${nsName}`,
          );

          const observabilityplaneEntities: Entity[] = observabilityplanes.map(
            op =>
              translateNewObservabilityPlaneToEntity(
                op,
                nsName,
                this.translatorContext,
              ),
          );
          allEntities.push(...observabilityplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch observabilityplanes for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get projects for each namespace and create System entities
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const projects = await fetchAllPages<NewProject>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/projects', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch projects for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${projects.length} projects in namespace: ${nsName}`,
          );

          // New API does not return deleted resources, no filtering needed
          const systemEntities: Entity[] = projects.map(project =>
            translateNewProjectToEntity(
              project,
              nsName,
              this.translatorContext,
            ),
          );
          allEntities.push(...systemEntities);

          // Fetch all deployment pipelines for this namespace (once, not per-project)
          const pipelineMap = new Map<
            string,
            DeploymentPipelineEntityV1alpha1
          >();

          try {
            const pipelines = await fetchAllPages<NewDeploymentPipeline>(() =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/deploymentpipelines', {
                  params: {
                    path: { namespaceName: nsName },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch deployment pipelines for ${nsName}`,
                    );
                  return res.data;
                }),
            );

            // The DP↔Project relation pair is emitted by
            // SystemEntityProcessor from each Project entity, so the DP
            // entity is now a faithful translation of the DP CR — no
            // need to compute a synthetic projectRefs array.
            for (const pipeline of pipelines) {
              const pipelineName = getName(pipeline)!;
              const pipelineKey = `${nsName}/${pipelineName}`;

              const pipelineEntity = translateNewDeploymentPipelineToEntity(
                pipeline,
                nsName,
                this.translatorContext,
              );
              pipelineMap.set(pipelineKey, pipelineEntity);
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch deployment pipelines for namespace ${nsName}: ${error}`,
            );
          }

          // Two-pass component processing:
          // Pass 1: Collect workload data for all components in this namespace
          // Pass 2: Create entities with cross-component dependency resolution

          // Build project lookup map for ownership resolution in pass 2
          const projectMap = new Map(projects.map(p => [getName(p)!, p]));

          const componentWorkloadMap = new Map<string, ComponentWorkloadData>();

          // Pass 1 — Collect workload data
          for (const project of projects) {
            const projectName = getName(project)!;

            try {
              const components = await fetchAllPages<NewComponent>(cursor =>
                client
                  .GET('/api/v1/namespaces/{namespaceName}/components', {
                    params: {
                      path: { namespaceName: nsName },
                      query: { project: projectName, limit: 100, cursor },
                    },
                  })
                  .then(res => {
                    if (res.error)
                      throw new Error(
                        `Failed to fetch components for project ${projectName}`,
                      );
                    return res.data;
                  }),
              );

              this.logger.debug(
                `Found ${components.length} components in project: ${projectName}`,
              );

              for (const component of components) {
                const componentName = getName(component)!;

                try {
                  const { data: workloadListData, error: workloadError } =
                    await client.GET(
                      '/api/v1/namespaces/{namespaceName}/workloads',
                      {
                        params: {
                          path: { namespaceName: nsName },
                          query: { component: componentName },
                        },
                      },
                    );

                  if (workloadError) {
                    this.logger.warn(
                      `Workload fetch returned error for component ${componentName} in project ${projectName}, namespace ${nsName}: ${JSON.stringify(
                        workloadError,
                      )}`,
                    );
                  }

                  const workloadData = workloadListData?.items?.[0];
                  const allEndpoints = workloadData
                    ? extractAllWorkloadEndpoints(workloadData)
                    : {};
                  const schemaEndpoints = extractSchemaEndpoints(allEndpoints);
                  const dependencies = workloadData
                    ? extractWorkloadDependencies(workloadData)
                    : [];
                  const resourceDependencies = workloadData
                    ? extractWorkloadResourceDependencies(workloadData)
                    : [];

                  componentWorkloadMap.set(`${projectName}:${componentName}`, {
                    component,
                    projectName,
                    schemaEndpoints,
                    allEndpoints,
                    dependencies,
                    resourceDependencies,
                    workloadName: workloadData?.metadata?.name,
                  });
                } catch (error) {
                  this.logger.warn(
                    `Failed to fetch workload for component ${componentName}: ${error}`,
                  );
                  // Store component without workload data so it still gets an entity
                  componentWorkloadMap.set(`${projectName}:${componentName}`, {
                    component,
                    projectName,
                    schemaEndpoints: {},
                    allEndpoints: {},
                    dependencies: [],
                    resourceDependencies: [],
                  });
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch components for project ${projectName} in namespace ${nsName}: ${error}`,
              );
            }
          }

          // Pass 2 — Create entities. Cross-resource resolution uses the
          // shared helpers so the periodic and event-driven paths emit
          // identical providesApis/consumesApis content.
          for (const [, workloadData] of componentWorkloadMap.entries()) {
            const {
              component,
              projectName,
              schemaEndpoints,
              dependencies,
              resourceDependencies,
              workloadName,
            } = workloadData;
            const componentName = getName(component)!;

            // Filter dependencies to those whose target endpoint actually
            // exposes a schema (only schemaful endpoints produce API
            // entities). Cheap O(1) lookup against the in-memory
            // componentWorkloadMap populated in pass 1 — no extra I/O.
            const filteredDependencies = await filterDependenciesWithSchema(
              dependencies,
              projectName,
              (targetProject, targetComponent, endpointName) => {
                const target = componentWorkloadMap.get(
                  `${targetProject}:${targetComponent}`,
                );
                return Boolean(target?.schemaEndpoints[endpointName]);
              },
            );

            const { providesApis, consumesApis } = resolveProvidesAndConsumes(
              schemaEndpoints,
              filteredDependencies,
              projectName,
              componentName,
            );

            // Resolve ownership: component annotation > project annotation > defaultOwner
            const project = projectMap.get(projectName)!;
            const resolvedOwner = resolveComponentOwner(
              component,
              project,
              this.defaultOwner,
            );

            const dependsOn = buildComponentDependsOnRefs(
              resourceDependencies,
              nsName,
            );

            const componentEntity = translateNewComponentToEntity(
              component,
              nsName,
              projectName,
              resolvedOwner,
              this.translatorContext,
              providesApis,
              consumesApis,
              workloadName,
              dependsOn,
            );
            allEntities.push(componentEntity);

            // Create API entities from schema endpoints. We only emit
            // API entities when there's a Workload (the schemas live on
            // workload endpoints), so workloadName is guaranteed to be
            // defined inside this branch.
            if (workloadName && Object.keys(schemaEndpoints).length > 0) {
              const apiEntities = createApiEntitiesFromNewWorkload({
                componentName,
                endpoints: schemaEndpoints,
                namespaceName: nsName,
                projectName,
                owner: resolvedOwner,
                locationKey: `provider:${this.getProviderName()}`,
                workloadName,
              });
              allEntities.push(...apiEntities);
            }
          }

          // Add all deduplicated pipeline entities for this namespace
          allEntities.push(...pipelineMap.values());
        } catch (error) {
          this.logger.warn(
            `Failed to fetch projects for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Fetch Component Type Definitions and generate Template entities
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          this.logger.info(
            `Fetching Component Type Definitions from OpenChoreo API for namespace: ${nsName}`,
          );

          const componentTypes = await fetchAllPages<NewComponentType>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/componenttypes', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch component types for ${nsName}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${componentTypes.length} CTDs in namespace: ${nsName}`,
          );

          // Fetch schemas in parallel for better performance
          const ctdsWithSchemas = await Promise.all(
            componentTypes.map(async ct => {
              const ctName = getName(ct);
              if (!ctName) return null;
              try {
                const { data: schemaData, error: schemaError } =
                  await client.GET(
                    '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema',
                    {
                      params: {
                        path: { namespaceName: nsName, ctName },
                      },
                    },
                  );

                if (schemaError || !schemaData) {
                  this.logger.warn(
                    `Failed to fetch schema for CTD ${ctName} in namespace ${nsName}`,
                  );
                  return null;
                }

                // Combine metadata from list item + schema into full object
                const fullComponentType = {
                  metadata: {
                    name: ctName,
                    displayName: getDisplayName(ct),
                    description: getDescription(ct),
                    workloadType: ct.spec?.workloadType ?? 'deployment',
                    allowedWorkflows: ct.spec?.allowedWorkflows,
                    allowedTraits: ct.spec?.allowedTraits,
                    createdAt: getCreatedAt(ct) || '',
                  },
                  spec: {
                    inputParametersSchema: schemaData as any,
                  },
                };

                return fullComponentType;
              } catch (error) {
                this.logger.warn(
                  `Failed to fetch schema for CTD ${ctName} in namespace ${nsName}: ${error}`,
                );
                return null;
              }
            }),
          );

          // Filter out failed schema fetches
          const validCTDs = ctdsWithSchemas.filter(
            (ctd): ctd is NonNullable<typeof ctd> => ctd !== null,
          );

          // Convert CTDs to template entities
          const templateEntities: Entity[] = validCTDs
            .map(ctd => {
              try {
                const templateEntity =
                  this.ctdConverter.convertCtdToTemplateEntity(ctd, nsName);
                if (!templateEntity.metadata.annotations) {
                  templateEntity.metadata.annotations = {};
                }
                templateEntity.metadata.annotations[
                  'backstage.io/managed-by-location'
                ] = `provider:${this.getProviderName()}`;
                templateEntity.metadata.annotations[
                  'backstage.io/managed-by-origin-location'
                ] = `provider:${this.getProviderName()}`;
                return templateEntity;
              } catch (error) {
                this.logger.warn(
                  `Failed to convert CTD ${ctd.metadata.name} to template: ${error}`,
                );
                return null;
              }
            })
            .filter((entity): entity is Entity => entity !== null);

          allEntities.push(...templateEntities);
          this.logger.info(
            `Successfully generated ${templateEntities.length} template entities from CTDs in namespace: ${nsName}`,
          );

          // Also generate ComponentType entities
          const componentTypeEntities = componentTypes
            .map(ct => {
              try {
                return translateNewComponentTypeToEntity(
                  ct,
                  nsName,
                  this.translatorContext,
                ) as Entity;
              } catch (error) {
                this.logger.warn(
                  `Failed to translate ComponentType ${getName(ct)}: ${error}`,
                );
                return null;
              }
            })
            .filter((entity): entity is Entity => entity !== null);

          allEntities.push(...componentTypeEntities);
          this.logger.debug(
            `Generated ${componentTypeEntities.length} ComponentType entities in namespace: ${nsName}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch Component Type Definitions for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get traits for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const traits = await fetchAllPages<NewTrait>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/traits', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch traits for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${traits.length} traits in namespace: ${nsName}`,
          );

          const traitEntities: Entity[] = traits.map(trait =>
            translateNewTraitToEntity(trait, nsName, this.translatorContext),
          );
          allEntities.push(...traitEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch traits for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get resource types for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const resourceTypes = await fetchAllPages<NewResourceType>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/resourcetypes', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch resource types for ${nsName}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${resourceTypes.length} resource types in namespace: ${nsName}`,
          );

          const rtEntities: Entity[] = resourceTypes
            .map(rt => {
              try {
                return translateNewResourceTypeToEntity(
                  rt,
                  nsName,
                  this.translatorContext,
                ) as Entity;
              } catch (err) {
                this.logger.warn(
                  `Failed to translate ResourceType ${getName(rt)}: ${err}`,
                );
                return null;
              }
            })
            .filter((e): e is Entity => e !== null);
          allEntities.push(...rtEntities);

          // Generate per-type scaffolder Template entities from each
          // ResourceType — mirrors the CTD template generation above.
          const rtsWithSchemas = await Promise.all(
            resourceTypes.map(async rt => {
              const rtName = getName(rt);
              if (!rtName) return null;
              try {
                const { data: schemaData, error: schemaError } =
                  await client.GET(
                    '/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}/schema',
                    {
                      params: {
                        path: { namespaceName: nsName, rtName },
                      },
                    },
                  );

                if (schemaError || !schemaData) {
                  this.logger.warn(
                    `Failed to fetch schema for ResourceType ${rtName} in namespace ${nsName}`,
                  );
                  return null;
                }

                return {
                  metadata: {
                    name: rtName,
                    displayName: getDisplayName(rt),
                    description: getDescription(rt),
                    createdAt: getCreatedAt(rt) || '',
                  },
                  spec: {
                    parameters: { openAPIV3Schema: schemaData as any },
                    retainPolicy: rt.spec?.retainPolicy as
                      | 'Delete'
                      | 'Retain'
                      | undefined,
                  },
                };
              } catch (error) {
                this.logger.warn(
                  `Failed to fetch schema for ResourceType ${rtName} in namespace ${nsName}: ${error}`,
                );
                return null;
              }
            }),
          );

          const validRts = rtsWithSchemas.filter(
            (rt): rt is NonNullable<typeof rt> => rt !== null,
          );

          const rtTemplateEntities: Entity[] = validRts
            .map(rt => {
              try {
                const templateEntity =
                  this.rtdConverter.convertRtdToTemplateEntity(rt, nsName);
                if (!templateEntity.metadata.annotations) {
                  templateEntity.metadata.annotations = {};
                }
                templateEntity.metadata.annotations[
                  'backstage.io/managed-by-location'
                ] = `provider:${this.getProviderName()}`;
                templateEntity.metadata.annotations[
                  'backstage.io/managed-by-origin-location'
                ] = `provider:${this.getProviderName()}`;
                return templateEntity;
              } catch (error) {
                this.logger.warn(
                  `Failed to convert ResourceType ${rt.metadata.name} to template: ${error}`,
                );
                return null;
              }
            })
            .filter((entity): entity is Entity => entity !== null);

          allEntities.push(...rtTemplateEntities);
          this.logger.debug(
            `Generated ${rtTemplateEntities.length} template entities from ResourceTypes in namespace: ${nsName}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch resource types for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get project types for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const projectTypes = await fetchAllPages<NewProjectType>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/projecttypes', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch project types for ${nsName}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${projectTypes.length} project types in namespace: ${nsName}`,
          );

          const ptEntities: Entity[] = projectTypes
            .map(pt => {
              try {
                return translateNewProjectTypeToEntity(
                  pt,
                  nsName,
                  this.translatorContext,
                ) as Entity;
              } catch (err) {
                this.logger.warn(
                  `Failed to translate ProjectType ${getName(pt)}: ${err}`,
                );
                return null;
              }
            })
            .filter((e): e is Entity => e !== null);
          allEntities.push(...ptEntities);

          // Generate per-type Project-creation Template entities. The
          // (Cluster)ProjectType list returns the full parameters schema
          // inline, so no extra /schema fetch is needed.
          const ptTemplateEntities: Entity[] = projectTypes
            .map(pt => {
              try {
                const templateEntity =
                  this.ptdConverter.convertPtdToTemplateEntity(
                    this.toProjectTypeCRD(pt),
                    nsName,
                  );
                this.stampManagedByLocation(templateEntity);
                return templateEntity;
              } catch (error) {
                this.logger.warn(
                  `Failed to convert ProjectType ${getName(
                    pt,
                  )} to template: ${error}`,
                );
                return null;
              }
            })
            .filter((entity): entity is Entity => entity !== null);
          allEntities.push(...ptTemplateEntities);
          this.logger.debug(
            `Generated ${ptTemplateEntities.length} template entities from ProjectTypes in namespace: ${nsName}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch project types for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get resources for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const resources = await fetchAllPages<NewResource>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/resources', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch resources for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${resources.length} resources in namespace: ${nsName}`,
          );

          const resourceEntities: Entity[] = resources
            .map(resource => {
              try {
                return translateNewResourceToEntity(
                  resource,
                  nsName,
                  this.translatorContext,
                );
              } catch (err) {
                this.logger.warn(
                  `Failed to translate Resource ${getName(resource)}: ${err}`,
                );
                return null;
              }
            })
            .filter((e): e is Entity => e !== null);
          allEntities.push(...resourceEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch resources for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get workflows for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const workflows = await fetchAllPages<NewWorkflow>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/workflows', {
                params: {
                  path: { namespaceName: nsName },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch workflows for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${workflows.length} workflows in namespace: ${nsName}`,
          );

          const workflowEntities: Entity[] = workflows.map(wf =>
            translateNewWorkflowToEntity(wf, nsName, this.translatorContext),
          );
          allEntities.push(...workflowEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch workflows for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Fetch cluster component types (once, not per namespace)
      try {
        const clusterComponentTypes =
          await fetchAllPages<NewClusterComponentType>(cursor =>
            client
              .GET('/api/v1/clustercomponenttypes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster component types');
                return res.data;
              }),
          );

        this.logger.debug(
          `Found ${clusterComponentTypes.length} cluster component types`,
        );

        const cctEntities = clusterComponentTypes
          .map(cct => {
            try {
              return translateNewClusterComponentTypeToEntity(
                cct,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterComponentType ${getName(
                  cct,
                )}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...cctEntities);

        // Generate Template entities from ClusterComponentTypes (parallel to namespace CTD template generation)
        const cctWithSchemas = await Promise.all(
          clusterComponentTypes.map(async cct => {
            const cctName = getName(cct);
            if (!cctName) return null;
            try {
              const { data: schemaData, error: schemaError } = await client.GET(
                '/api/v1/clustercomponenttypes/{cctName}/schema',
                {
                  params: {
                    path: { cctName },
                  },
                },
              );

              if (schemaError || !schemaData) {
                this.logger.warn(
                  `Failed to fetch schema for ClusterComponentType ${cctName}`,
                );
                return null;
              }

              return {
                metadata: {
                  name: cctName,
                  displayName: getDisplayName(cct),
                  description: getDescription(cct),
                  workloadType: cct.spec?.workloadType ?? 'deployment',
                  allowedWorkflows: cct.spec?.allowedWorkflows?.map(
                    w => w.name,
                  ),
                  allowedTraits: cct.spec?.allowedTraits?.map(t => ({
                    kind: 'ClusterTrait' as const,
                    name: t.name,
                  })),
                  createdAt: getCreatedAt(cct) || '',
                },
                spec: {
                  inputParametersSchema: schemaData as any,
                },
              };
            } catch (error) {
              this.logger.warn(
                `Failed to fetch schema for ClusterComponentType ${cctName}: ${error}`,
              );
              return null;
            }
          }),
        );

        const validCCTs = cctWithSchemas.filter(
          (cct): cct is NonNullable<typeof cct> => cct !== null,
        );

        const cctTemplateEntities: Entity[] = validCCTs
          .map(cct => {
            try {
              const templateEntity =
                this.ctdConverter.convertClusterCtdToTemplateEntity(cct);
              if (!templateEntity.metadata.annotations) {
                templateEntity.metadata.annotations = {};
              }
              templateEntity.metadata.annotations[
                'backstage.io/managed-by-location'
              ] = `provider:${this.getProviderName()}`;
              templateEntity.metadata.annotations[
                'backstage.io/managed-by-origin-location'
              ] = `provider:${this.getProviderName()}`;
              return templateEntity;
            } catch (error) {
              this.logger.warn(
                `Failed to convert ClusterComponentType ${cct.metadata.name} to template: ${error}`,
              );
              return null;
            }
          })
          .filter((entity): entity is Entity => entity !== null);

        allEntities.push(...cctTemplateEntities);
        this.logger.info(
          `Successfully generated ${cctTemplateEntities.length} template entities from ClusterComponentTypes`,
        );
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster component types: ${error}`);
      }

      // Fetch cluster resource types (once, not per namespace)
      try {
        const clusterResourceTypes =
          await fetchAllPages<NewClusterResourceType>(cursor =>
            client
              .GET('/api/v1/clusterresourcetypes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster resource types');
                return res.data;
              }),
          );

        this.logger.debug(
          `Found ${clusterResourceTypes.length} cluster resource types`,
        );

        const crtEntities: Entity[] = clusterResourceTypes
          .map(crt => {
            try {
              return translateNewClusterResourceTypeToEntity(
                crt,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterResourceType ${getName(
                  crt,
                )}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...crtEntities);

        // Generate per-type scaffolder Template entities from each
        // ClusterResourceType — mirrors the CCT template generation above.
        const crtsWithSchemas = await Promise.all(
          clusterResourceTypes.map(async crt => {
            const crtName = getName(crt);
            if (!crtName) return null;
            try {
              const { data: schemaData, error: schemaError } = await client.GET(
                '/api/v1/clusterresourcetypes/{crtName}/schema',
                {
                  params: {
                    path: { crtName },
                  },
                },
              );

              if (schemaError || !schemaData) {
                this.logger.warn(
                  `Failed to fetch schema for ClusterResourceType ${crtName}`,
                );
                return null;
              }

              return {
                metadata: {
                  name: crtName,
                  displayName: getDisplayName(crt),
                  description: getDescription(crt),
                  createdAt: getCreatedAt(crt) || '',
                },
                spec: {
                  parameters: { openAPIV3Schema: schemaData as any },
                  retainPolicy: crt.spec?.retainPolicy as
                    | 'Delete'
                    | 'Retain'
                    | undefined,
                },
              };
            } catch (error) {
              this.logger.warn(
                `Failed to fetch schema for ClusterResourceType ${crtName}: ${error}`,
              );
              return null;
            }
          }),
        );

        const validCrts = crtsWithSchemas.filter(
          (crt): crt is NonNullable<typeof crt> => crt !== null,
        );

        const crtTemplateEntities: Entity[] = validCrts
          .map(crt => {
            try {
              const templateEntity =
                this.rtdConverter.convertClusterRtdToTemplateEntity(crt);
              if (!templateEntity.metadata.annotations) {
                templateEntity.metadata.annotations = {};
              }
              templateEntity.metadata.annotations[
                'backstage.io/managed-by-location'
              ] = `provider:${this.getProviderName()}`;
              templateEntity.metadata.annotations[
                'backstage.io/managed-by-origin-location'
              ] = `provider:${this.getProviderName()}`;
              return templateEntity;
            } catch (error) {
              this.logger.warn(
                `Failed to convert ClusterResourceType ${crt.metadata.name} to template: ${error}`,
              );
              return null;
            }
          })
          .filter((entity): entity is Entity => entity !== null);

        allEntities.push(...crtTemplateEntities);
        this.logger.info(
          `Successfully generated ${crtTemplateEntities.length} template entities from ClusterResourceTypes`,
        );
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster resource types: ${error}`);
      }

      // Fetch cluster project types (once, not per namespace)
      try {
        const clusterProjectTypes = await fetchAllPages<NewClusterProjectType>(
          cursor =>
            client
              .GET('/api/v1/clusterprojecttypes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster project types');
                return res.data;
              }),
        );

        this.logger.debug(
          `Found ${clusterProjectTypes.length} cluster project types`,
        );

        const cptEntities: Entity[] = clusterProjectTypes
          .map(cpt => {
            try {
              return translateNewClusterProjectTypeToEntity(
                cpt,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterProjectType ${getName(
                  cpt,
                )}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...cptEntities);

        // Generate per-type Project-creation Template entities (cluster scope).
        const cptTemplateEntities: Entity[] = clusterProjectTypes
          .map(cpt => {
            try {
              const templateEntity =
                this.ptdConverter.convertClusterPtdToTemplateEntity(
                  this.toProjectTypeCRD(cpt),
                );
              this.stampManagedByLocation(templateEntity);
              return templateEntity;
            } catch (error) {
              this.logger.warn(
                `Failed to convert ClusterProjectType ${getName(
                  cpt,
                )} to template: ${error}`,
              );
              return null;
            }
          })
          .filter((entity): entity is Entity => entity !== null);
        allEntities.push(...cptTemplateEntities);
        this.logger.info(
          `Successfully generated ${cptTemplateEntities.length} template entities from ClusterProjectTypes`,
        );
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster project types: ${error}`);
      }

      // Fetch cluster traits (once, not per namespace)
      try {
        const clusterTraits = await fetchAllPages<NewClusterTrait>(cursor =>
          client
            .GET('/api/v1/clustertraits', {
              params: { query: { limit: 100, cursor } },
            })
            .then(res => {
              if (res.error) throw new Error('Failed to fetch cluster traits');
              return res.data;
            }),
        );

        this.logger.debug(`Found ${clusterTraits.length} cluster traits`);

        const ctEntities: Entity[] = clusterTraits
          .map(ct => {
            try {
              return translateNewClusterTraitToEntity(
                ct,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterTrait ${getName(ct)}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...ctEntities);
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster traits: ${error}`);
      }

      // Fetch cluster workflows (once, not per namespace)
      try {
        const clusterWorkflows = await fetchAllPages<NewClusterWorkflow>(
          cursor =>
            client
              .GET('/api/v1/clusterworkflows', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error) {
                  const msg =
                    typeof res.error === 'object' &&
                    res.error !== null &&
                    'message' in res.error
                      ? (res.error as { message: string }).message
                      : JSON.stringify(res.error);
                  throw new Error(
                    `Failed to fetch cluster workflows: ${res.response.status} ${res.response.statusText} - ${msg}`,
                  );
                }
                return res.data;
              }),
        );

        this.logger.info(`Found ${clusterWorkflows.length} cluster workflows`);

        const cwfEntities: Entity[] = clusterWorkflows
          .map(cwf => {
            try {
              return translateNewClusterWorkflowToEntity(
                cwf,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterWorkflow ${getName(cwf)}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...cwfEntities);
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster workflows: ${error}`);
      }

      // Fetch cluster dataplanes (once, not per namespace)
      try {
        const clusterDataplanes = await fetchAllPages<NewClusterDataPlane>(
          cursor =>
            client
              .GET('/api/v1/clusterdataplanes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster dataplanes');
                return res.data;
              }),
        );

        this.logger.debug(
          `Found ${clusterDataplanes.length} cluster dataplanes`,
        );

        const cdpEntities: Entity[] = clusterDataplanes
          .map(cdp => {
            try {
              return translateNewClusterDataplaneToEntity(
                cdp,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterDataPlane ${getName(cdp)}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...cdpEntities);
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster dataplanes: ${error}`);
      }

      // Fetch cluster observability planes (once, not per namespace)
      try {
        const clusterObservabilityPlanes =
          await fetchAllPages<NewClusterObservabilityPlane>(cursor =>
            client
              .GET('/api/v1/clusterobservabilityplanes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    'Failed to fetch cluster observability planes',
                  );
                return res.data;
              }),
          );

        this.logger.debug(
          `Found ${clusterObservabilityPlanes.length} cluster observability planes`,
        );

        const copEntities: Entity[] = clusterObservabilityPlanes
          .map(cop => {
            try {
              return translateNewClusterObservabilityPlaneToEntity(
                cop,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterObservabilityPlane ${getName(
                  cop,
                )}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);
        allEntities.push(...copEntities);
      } catch (error) {
        this.logger.warn(
          `Failed to fetch cluster observability planes: ${error}`,
        );
      }

      // Fetch cluster workflow planes (once, not per namespace)
      try {
        const clusterWorkflowPlanes =
          await fetchAllPages<NewClusterWorkflowPlane>(cursor =>
            client
              .GET('/api/v1/clusterworkflowplanes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster workflow planes');
                return res.data;
              }),
          );

        this.logger.debug(
          `Found ${clusterWorkflowPlanes.length} cluster workflow planes`,
        );

        const cbpEntities: Entity[] = clusterWorkflowPlanes
          .map(cbp => {
            try {
              return translateNewClusterWorkflowPlaneToEntity(
                cbp,
                this.translatorContext,
              ) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterWorkflowPlane ${getName(
                  cbp,
                )}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);

        allEntities.push(...cbpEntities);
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster workflow planes: ${error}`);
      }

      await this.connection!.applyMutation({
        type: 'full',
        entities: allEntities.map(entity => ({
          entity,
          locationKey: `provider:${this.getProviderName()}`,
        })),
      });

      this.logEntityCounts(allEntities, domainEntities.length);
    } catch (error) {
      this.logger.error(`Failed to run OpenChoreoEntityProvider: ${error}`);
    }
  }

  private logEntityCounts(allEntities: Entity[], domainCount: number): void {
    const systemCount = allEntities.filter(e => e.kind === 'System').length;
    const componentCount = allEntities.filter(
      e => e.kind === 'Component',
    ).length;
    const apiCount = allEntities.filter(e => e.kind === 'API').length;
    const environmentCount = allEntities.filter(
      e => e.kind === 'Environment',
    ).length;
    const notificationChannelCount = allEntities.filter(
      e => e.kind === 'ObservabilityAlertsNotificationChannel',
    ).length;
    const dataplaneCount = allEntities.filter(
      e => e.kind === 'Dataplane',
    ).length;
    const workflowplaneCount = allEntities.filter(
      e => e.kind === 'WorkflowPlane',
    ).length;
    const observabilityplaneCount = allEntities.filter(
      e => e.kind === 'ObservabilityPlane',
    ).length;
    const pipelineCount = allEntities.filter(
      e => e.kind === 'DeploymentPipeline',
    ).length;
    const componentTypeCount = allEntities.filter(
      e => e.kind === 'ComponentType',
    ).length;
    const traitTypeCount = allEntities.filter(
      e => e.kind === 'TraitType',
    ).length;
    const resourceTypeCount = allEntities.filter(
      e => e.kind === 'ResourceType',
    ).length;
    const projectTypeCount = allEntities.filter(
      e => e.kind === 'ProjectType',
    ).length;
    const resourceCount = allEntities.filter(e => e.kind === 'Resource').length;
    const clusterComponentTypeCount = allEntities.filter(
      e => e.kind === 'ClusterComponentType',
    ).length;
    const clusterResourceTypeCount = allEntities.filter(
      e => e.kind === 'ClusterResourceType',
    ).length;
    const clusterProjectTypeCount = allEntities.filter(
      e => e.kind === 'ClusterProjectType',
    ).length;
    const clusterTraitTypeCount = allEntities.filter(
      e => e.kind === 'ClusterTraitType',
    ).length;
    const clusterDataplaneCount = allEntities.filter(
      e => e.kind === 'ClusterDataplane',
    ).length;
    const clusterObservabilityPlaneCount = allEntities.filter(
      e => e.kind === 'ClusterObservabilityPlane',
    ).length;
    const clusterWorkflowPlaneCount = allEntities.filter(
      e => e.kind === 'ClusterWorkflowPlane',
    ).length;
    const workflowCount = allEntities.filter(e => e.kind === 'Workflow').length;
    const clusterWorkflowCount = allEntities.filter(
      e => e.kind === 'ClusterWorkflow',
    ).length;
    this.logger.info(
      `Successfully processed ${allEntities.length} entities (${domainCount} domains, ${systemCount} systems, ${componentCount} components, ${apiCount} apis, ${environmentCount} environments, ${notificationChannelCount} notification channels, ${dataplaneCount} dataplanes, ${workflowplaneCount} workflowplanes, ${observabilityplaneCount} observabilityplanes, ${pipelineCount} deployment pipelines, ${componentTypeCount} component types, ${traitTypeCount} trait types, ${resourceTypeCount} resource types, ${projectTypeCount} project types, ${resourceCount} resources, ${clusterComponentTypeCount} cluster component types, ${clusterResourceTypeCount} cluster resource types, ${clusterProjectTypeCount} cluster project types, ${clusterTraitTypeCount} cluster trait types, ${clusterDataplaneCount} cluster dataplanes, ${clusterObservabilityPlaneCount} cluster observability planes, ${clusterWorkflowPlaneCount} cluster workflow planes, ${workflowCount} workflows, ${clusterWorkflowCount} cluster workflows)`,
    );
  }
}
