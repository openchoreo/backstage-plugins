import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  isReady,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import type {
  NamespaceResponse,
  ComponentResponse,
} from '@openchoreo/backstage-plugin-common';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

type ModelsNamespace = NamespaceResponse;
type ModelsComponent = ComponentResponse;

// New API types
type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];
type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];
type NewEnvironment = OpenChoreoComponents['schemas']['Environment'];
type NewDataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type NewBuildPlane = OpenChoreoComponents['schemas']['BuildPlane'];
type NewObservabilityPlane =
  OpenChoreoComponents['schemas']['ObservabilityPlane'];
type NewDeploymentPipeline =
  OpenChoreoComponents['schemas']['DeploymentPipeline'];
type NewComponentType = OpenChoreoComponents['schemas']['ComponentType'];
type NewTrait = OpenChoreoComponents['schemas']['Trait'];
type NewClusterComponentType =
  OpenChoreoComponents['schemas']['ClusterComponentType'];
type NewClusterTrait = OpenChoreoComponents['schemas']['ClusterTrait'];
type NewClusterDataPlane = OpenChoreoComponents['schemas']['ClusterDataPlane'];
type NewClusterObservabilityPlane =
  OpenChoreoComponents['schemas']['ClusterObservabilityPlane'];
type NewClusterBuildPlane =
  OpenChoreoComponents['schemas']['ClusterBuildPlane'];
type NewWorkflow = OpenChoreoComponents['schemas']['Workflow'];
type NewWorkload = OpenChoreoComponents['schemas']['Workload'];
type NewAgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];

// WorkloadEndpoint is part of the workload.endpoints structure
// Since Workload uses additionalProperties, we define this locally
interface WorkloadEndpoint {
  type: string;
  port: number;
  visibility?: string[];
  schema?: {
    content?: string;
  };
}

/** Endpoint types that represent actual APIs and should be cataloged as Endpoint entities */
const API_ENDPOINT_TYPES = new Set(['REST', 'GraphQL', 'gRPC']);
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  ComponentTypeUtils,
} from '@openchoreo/backstage-plugin-common';
import {
  EnvironmentEntityV1alpha1,
  DataplaneEntityV1alpha1,
  BuildPlaneEntityV1alpha1,
  ObservabilityPlaneEntityV1alpha1,
  DeploymentPipelineEntityV1alpha1,
  ComponentTypeEntityV1alpha1,
  TraitTypeEntityV1alpha1,
  WorkflowEntityV1alpha1,
  ClusterComponentTypeEntityV1alpha1,
  ClusterTraitTypeEntityV1alpha1,
  ClusterDataplaneEntityV1alpha1,
  ClusterObservabilityPlaneEntityV1alpha1,
  ClusterBuildPlaneEntityV1alpha1,
} from '../kinds';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import {
  translateComponentToEntity as translateComponent,
  translateProjectToEntity as translateProject,
  translateEnvironmentToEntity as translateEnvironment,
  translateComponentTypeToEntity as translateCT,
  translateTraitToEntity as translateTrait,
  translateClusterComponentTypeToEntity as translateClusterCT,
  translateClusterTraitToEntity as translateClusterTrait,
} from '../utils/entityTranslation';

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
  private readonly componentTypeUtils: ComponentTypeUtils;
  private readonly tokenService?: OpenChoreoTokenService;

  constructor(
    taskRunner: SchedulerServiceTaskRunner,
    logger: LoggerService,
    config: Config,
    tokenService?: OpenChoreoTokenService,
  ) {
    this.taskRunner = taskRunner;
    this.logger = logger;
    this.baseUrl = config.getString('openchoreo.baseUrl');
    this.tokenService = tokenService;
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
    // Initialize component type utilities from config
    this.componentTypeUtils = ComponentTypeUtils.fromConfig(config);
  }

  getProviderName(): string {
    return 'OpenChoreoEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.run();
      },
    });
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

      // Get service token for background task (client credentials flow)
      let token: string | undefined;
      if (this.tokenService?.hasServiceCredentials()) {
        try {
          token = await this.tokenService.getServiceToken();
          this.logger.debug('Using service token for OpenChoreo API requests');
        } catch (error) {
          this.logger.warn(
            `Failed to get service token, continuing without auth: ${error}`,
          );
        }
      }

      // Create new API client
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
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
        this.translateNamespaceToDomain(ns),
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

          this.logger.debug(
            `Found ${environments.length} environments in namespace: ${nsName}`,
          );

          const environmentEntities: Entity[] = environments.map(env =>
            this.translateNewEnvironmentToEntity(env, nsName),
          );
          allEntities.push(...environmentEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch environments for namespace ${nsName}: ${error}`,
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
            this.translateNewDataplaneToEntity(dp, nsName),
          );
          allEntities.push(...dataplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch dataplanes for namespace ${nsName}: ${error}`,
          );
        }
      }

      // Get buildplanes for each namespace
      for (const ns of namespaces) {
        const nsName = getName(ns)!;
        try {
          const buildplanes = await fetchAllPages<NewBuildPlane>(() =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/buildplanes', {
                params: {
                  path: { namespaceName: nsName },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch buildplanes for ${nsName}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${buildplanes.length} buildplanes in namespace: ${nsName}`,
          );

          const buildplaneEntities: Entity[] = buildplanes.map(bp =>
            this.translateNewBuildPlaneToEntity(bp, nsName),
          );
          allEntities.push(...buildplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch buildplanes for namespace ${nsName}: ${error}`,
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
            op => this.translateNewObservabilityPlaneToEntity(op, nsName),
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
            this.translateNewProjectToEntity(project, nsName),
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

            // Match pipelines to projects via project.spec.deploymentPipelineRef
            for (const pipeline of pipelines) {
              const pipelineName = getName(pipeline)!;
              const pipelineKey = `${nsName}/${pipelineName}`;

              // Find all projects that reference this pipeline
              const referencingProjects = projects.filter(
                p => p.spec?.deploymentPipelineRef === pipelineName,
              );

              if (referencingProjects.length > 0) {
                const firstProjectName = getName(referencingProjects[0])!;
                const pipelineEntity =
                  this.translateNewDeploymentPipelineToEntity(
                    pipeline,
                    nsName,
                    firstProjectName,
                  );

                // Add all additional project refs
                for (let i = 1; i < referencingProjects.length; i++) {
                  const projName = getName(referencingProjects[i])!;
                  if (!pipelineEntity.spec.projectRefs?.includes(projName)) {
                    pipelineEntity.spec.projectRefs = [
                      ...(pipelineEntity.spec.projectRefs || []),
                      projName,
                    ];
                  }
                }

                pipelineMap.set(pipelineKey, pipelineEntity);
              } else {
                // Pipeline exists but no project references it — still create entity
                const pipelineEntity =
                  this.translateNewDeploymentPipelineToEntity(
                    pipeline,
                    nsName,
                    '',
                  );
                pipelineMap.set(pipelineKey, pipelineEntity);
              }
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch deployment pipelines for namespace ${nsName}: ${error}`,
            );
          }

          // Get components for each project
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

              // New API does not return deleted resources, no filtering needed
              for (const component of components) {
                const componentName = getName(component)!;

                // Fetch workload to check for endpoints
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

                  const workloadData = workloadListData?.items?.[0];
                  const endpoints = workloadData
                    ? this.extractWorkloadEndpoints(workloadData)
                    : {};
                  const hasEndpoints = Object.keys(endpoints).length > 0;

                  if (!workloadError && hasEndpoints) {
                    const providesApis = Object.keys(endpoints).map(
                      epName => `${componentName}-${epName}`,
                    );

                    const componentEntity = this.translateNewComponentToEntity(
                      component,
                      nsName,
                      projectName,
                      providesApis,
                    );
                    allEntities.push(componentEntity);

                    // Create API entities from workload endpoints
                    const apiEntities = this.createApiEntitiesFromNewWorkload(
                      componentName,
                      endpoints,
                      nsName,
                      projectName,
                    );
                    allEntities.push(...apiEntities);
                  } else {
                    if (workloadError) {
                      this.logger.warn(
                        `Workload fetch returned error for component ${componentName} in project ${projectName}, namespace ${nsName}: ${JSON.stringify(
                          workloadError,
                        )}`,
                      );
                    }
                    const componentEntity = this.translateNewComponentToEntity(
                      component,
                      nsName,
                      projectName,
                    );
                    allEntities.push(componentEntity);
                  }
                } catch (error) {
                  this.logger.warn(
                    `Failed to fetch workload for component ${componentName}: ${error}`,
                  );
                  const componentEntity = this.translateNewComponentToEntity(
                    component,
                    nsName,
                    projectName,
                  );
                  allEntities.push(componentEntity);
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch components for project ${projectName} in namespace ${nsName}: ${error}`,
              );
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
                return this.translateNewComponentTypeToEntity(
                  ct,
                  nsName,
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
            this.translateNewTraitToEntity(trait, nsName),
          );
          allEntities.push(...traitEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch traits for namespace ${nsName}: ${error}`,
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
            this.translateNewWorkflowToEntity(wf, nsName),
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
              return this.translateNewClusterComponentTypeToEntity(
                cct,
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
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster component types: ${error}`);
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
              return this.translateNewClusterTraitToEntity(ct) as Entity;
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
              return this.translateNewClusterDataplaneToEntity(cdp) as Entity;
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
              return this.translateNewClusterObservabilityPlaneToEntity(
                cop,
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

      // Fetch cluster build planes (once, not per namespace)
      let clusterBuildPlaneNames: string[] = [];
      try {
        const clusterBuildPlanes = await fetchAllPages<NewClusterBuildPlane>(
          cursor =>
            client
              .GET('/api/v1/clusterbuildplanes', {
                params: { query: { limit: 100, cursor } },
              })
              .then(res => {
                if (res.error)
                  throw new Error('Failed to fetch cluster build planes');
                return res.data;
              }),
        );

        this.logger.debug(
          `Found ${clusterBuildPlanes.length} cluster build planes`,
        );

        const cbpEntities: Entity[] = clusterBuildPlanes
          .map(cbp => {
            try {
              return this.translateNewClusterBuildPlaneToEntity(cbp) as Entity;
            } catch (err) {
              this.logger.warn(
                `Failed to translate ClusterBuildPlane ${getName(cbp)}: ${err}`,
              );
              return null;
            }
          })
          .filter((e): e is Entity => e !== null);

        clusterBuildPlaneNames = cbpEntities
          .map(e => e.metadata.name)
          .filter((n): n is string => !!n);

        allEntities.push(...cbpEntities);
      } catch (error) {
        this.logger.warn(`Failed to fetch cluster build planes: ${error}`);
      }

      // Apply buildPlaneRef fallback for projects without explicit buildPlaneRef
      this.applyBuildPlaneFallback(allEntities, clusterBuildPlaneNames);

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
    const dataplaneCount = allEntities.filter(
      e => e.kind === 'Dataplane',
    ).length;
    const buildplaneCount = allEntities.filter(
      e => e.kind === 'BuildPlane',
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
    const clusterComponentTypeCount = allEntities.filter(
      e => e.kind === 'ClusterComponentType',
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
    const clusterBuildPlaneCount = allEntities.filter(
      e => e.kind === 'ClusterBuildPlane',
    ).length;
    const workflowCount = allEntities.filter(e => e.kind === 'Workflow').length;
    const componentWorkflowCount = allEntities.filter(
      e => e.kind === 'ComponentWorkflow',
    ).length;
    this.logger.info(
      `Successfully processed ${allEntities.length} entities (${domainCount} domains, ${systemCount} systems, ${componentCount} components, ${apiCount} apis, ${environmentCount} environments, ${dataplaneCount} dataplanes, ${buildplaneCount} buildplanes, ${observabilityplaneCount} observabilityplanes, ${pipelineCount} deployment pipelines, ${componentTypeCount} component types, ${traitTypeCount} trait types, ${clusterComponentTypeCount} cluster component types, ${clusterTraitTypeCount} cluster trait types, ${clusterDataplaneCount} cluster dataplanes, ${clusterObservabilityPlaneCount} cluster observability planes, ${clusterBuildPlaneCount} cluster build planes, ${workflowCount} workflows, ${componentWorkflowCount} component workflows)`,
    );
  }

  /**
   * Translates a ModelsNamespace from OpenChoreo API to a Backstage Domain entity
   */
  private translateNamespaceToDomain(
    namespace: ModelsNamespace | NewNamespace,
  ): Entity {
    const isNew = 'metadata' in namespace;
    const name = isNew
      ? getName(namespace as NewNamespace)
      : (namespace as ModelsNamespace).name;
    const displayName = isNew
      ? getDisplayName(namespace as NewNamespace)
      : (namespace as ModelsNamespace).displayName;
    const description = isNew
      ? getDescription(namespace as NewNamespace)
      : (namespace as ModelsNamespace).description;
    const createdAt = isNew
      ? getCreatedAt(namespace as NewNamespace)
      : (namespace as ModelsNamespace).createdAt;
    const status = isNew
      ? (namespace as NewNamespace).status?.phase
      : (namespace as ModelsNamespace).status;

    const domainEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Domain',
      metadata: {
        name: name!,
        title: displayName || name!,
        description: description || name!,
        // namespace: 'default',
        tags: ['openchoreo', 'namespace', 'domain'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: name!,
          ...(createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: createdAt,
          }),
          ...(status && {
            [CHOREO_ANNOTATIONS.STATUS]: status,
          }),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
        },
      },
      spec: {
        owner: this.defaultOwner,
      },
    };

    return domainEntity;
  }

  // ───────────────────────────────────────────────────────────
  // New API translation methods
  // ───────────────────────────────────────────────────────────

  /**
   * Translates a new API Environment to a Backstage Environment entity.
   * Adapts K8s-style fields to the shared translation function's input shape.
   */
  private translateNewEnvironmentToEntity(
    env: NewEnvironment,
    namespaceName: string,
  ): EnvironmentEntityV1alpha1 {
    return translateEnvironment(
      {
        name: getName(env)!,
        displayName: getDisplayName(env),
        description: getDescription(env),
        uid: getUid(env),
        isProduction: env.spec?.isProduction,
        dataPlaneRef: env.spec?.dataPlaneRef
          ? {
              kind: env.spec.dataPlaneRef.kind,
              name: env.spec.dataPlaneRef.name,
            }
          : undefined,
        dnsPrefix: env.spec?.gateway?.ingress?.external?.http?.host,
        createdAt: getCreatedAt(env),
        status: isReady(env) ? 'Ready' : 'Not Ready',
      },
      namespaceName,
      { locationKey: this.getProviderName() },
    );
  }

  /**
   * Translates a new API DataPlane to a Backstage Dataplane entity.
   */
  private translateNewDataplaneToEntity(
    dp: NewDataPlane,
    namespaceName: string,
  ): DataplaneEntityV1alpha1 {
    const dpName = getName(dp)!;
    const gateway = dp.spec?.gateway;
    const obsPlaneRef = dp.spec?.observabilityPlaneRef;
    const normalizedObsRef = this.normalizeObservabilityPlaneRef(
      obsPlaneRef?.name,
      namespaceName,
    );

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Dataplane',
      metadata: {
        name: dpName,
        namespace: namespaceName,
        title: getDisplayName(dp) || dpName,
        description: getDescription(dp) || `${dpName} dataplane`,
        tags: ['openchoreo', 'dataplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(dp) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(dp) ? 'Ready' : 'Not Ready',
          'openchoreo.io/public-virtual-host':
            gateway?.ingress?.external?.http?.host || '',
          'openchoreo.io/namespace-virtual-host':
            gateway?.ingress?.internal?.http?.host || '',
          'openchoreo.io/public-http-port':
            gateway?.ingress?.external?.http?.port?.toString() || '',
          'openchoreo.io/public-https-port':
            gateway?.ingress?.external?.https?.port?.toString() || '',
          'openchoreo.io/namespace-http-port':
            gateway?.ingress?.internal?.http?.port?.toString() || '',
          'openchoreo.io/namespace-https-port':
            gateway?.ingress?.internal?.https?.port?.toString() || '',
          [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: normalizedObsRef,
          ...this.mapNewAgentConnectionAnnotations(dp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/dataplane': 'true',
        },
      },
      spec: {
        domain: `default/${namespaceName}`,
        publicVirtualHost: gateway?.ingress?.external?.http?.host,
        namespaceVirtualHost: gateway?.ingress?.internal?.http?.host,
        publicHTTPPort: gateway?.ingress?.external?.http?.port,
        publicHTTPSPort: gateway?.ingress?.external?.https?.port,
        namespaceHTTPPort: gateway?.ingress?.internal?.http?.port,
        namespaceHTTPSPort: gateway?.ingress?.internal?.https?.port,
        observabilityPlaneRef: normalizedObsRef,
      },
    };
  }

  /**
   * Translates a new API BuildPlane to a Backstage BuildPlane entity.
   */
  private translateNewBuildPlaneToEntity(
    bp: NewBuildPlane,
    namespaceName: string,
  ): BuildPlaneEntityV1alpha1 {
    const bpName = getName(bp)!;
    const obsPlaneRef = bp.spec?.observabilityPlaneRef;
    const normalizedObsRef = this.normalizeObservabilityPlaneRef(
      obsPlaneRef?.name,
      namespaceName,
    );

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'BuildPlane',
      metadata: {
        name: bpName,
        namespace: namespaceName,
        title: getDisplayName(bp) || bpName,
        description: getDescription(bp) || `${bpName} build plane`,
        tags: ['openchoreo', 'buildplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(bp) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(bp) ? 'Ready' : 'Not Ready',
          [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: normalizedObsRef,
          ...this.mapNewAgentConnectionAnnotations(bp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/buildplane': 'true',
        },
      },
      spec: {
        domain: `default/${namespaceName}`,
        observabilityPlaneRef: normalizedObsRef,
      },
    };
  }

  /**
   * Translates a new API ObservabilityPlane to a Backstage ObservabilityPlane entity.
   */
  private translateNewObservabilityPlaneToEntity(
    op: NewObservabilityPlane,
    namespaceName: string,
  ): ObservabilityPlaneEntityV1alpha1 {
    const opName = getName(op)!;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ObservabilityPlane',
      metadata: {
        name: opName,
        namespace: namespaceName,
        title: getDisplayName(op) || opName,
        description: getDescription(op) || `${opName} observability plane`,
        tags: ['openchoreo', 'observabilityplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(op) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(op) ? 'Ready' : 'Not Ready',
          ...(op.spec?.observerURL && {
            [CHOREO_ANNOTATIONS.OBSERVER_URL]: op.spec.observerURL,
          }),
          ...this.mapNewAgentConnectionAnnotations(op.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/observabilityplane': 'true',
        },
      },
      spec: {
        domain: `default/${namespaceName}`,
        observerURL: op.spec?.observerURL,
      },
    };
  }

  /**
   * Maps new API agent connection status to Backstage entity annotations.
   */
  private mapNewAgentConnectionAnnotations(
    agentConnection?: NewAgentConnectionStatus,
  ): Record<string, string> {
    if (!agentConnection) {
      return {};
    }

    const annotations: Record<string, string> = {
      [CHOREO_ANNOTATIONS.AGENT_CONNECTED]:
        agentConnection.connected?.toString() || 'false',
      [CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT]:
        agentConnection.connectedAgents?.toString() || '0',
    };

    if (agentConnection.lastConnectedTime) {
      annotations[CHOREO_ANNOTATIONS.AGENT_LAST_CONNECTED] =
        agentConnection.lastConnectedTime;
    }

    return annotations;
  }

  /**
   * Translates a new API Project to a Backstage System entity.
   */
  private translateNewProjectToEntity(
    project: NewProject,
    namespaceName: string,
  ): Entity {
    const buildPlaneRef = project.spec?.buildPlaneRef as
      | { kind?: string; name?: string }
      | undefined;

    return translateProject(
      {
        name: getName(project)!,
        displayName: getDisplayName(project),
        description: getDescription(project),
        namespaceName: getNamespace(project) ?? namespaceName,
        uid: getUid(project),
        buildPlaneRef,
      },
      namespaceName,
      {
        locationKey: this.getProviderName(),
        defaultOwner: this.defaultOwner,
      },
    );
  }

  /**
   * Translates a new API Component to a Backstage Component entity.
   */
  private translateNewComponentToEntity(
    component: NewComponent,
    namespaceName: string,
    projectName: string,
    providesApis?: string[],
  ): Entity {
    const componentName = getName(component)!;
    const componentTypeRef = component.spec?.componentType;
    const componentType =
      typeof componentTypeRef === 'string'
        ? componentTypeRef
        : componentTypeRef?.name ?? '';

    // Adapt to the legacy-shaped ModelsComponent for the shared translation function
    return translateComponent(
      {
        name: componentName,
        uid: getUid(component),
        type: componentType,
        status: isReady(component) ? 'Ready' : 'Not Ready',
        createdAt: getCreatedAt(component),
        description: getDescription(component),
        deletionTimestamp: undefined,
        // Pass componentWorkflow for repository info extraction
        componentWorkflow: component.spec?.workflow
          ? {
              name: component.spec.workflow.name ?? '',
              systemParameters: {
                repository: {
                  url:
                    component.spec.workflow.systemParameters?.repository?.url ??
                    '',
                  appPath:
                    component.spec.workflow.systemParameters?.repository
                      ?.appPath,
                  revision: {
                    branch:
                      component.spec.workflow.systemParameters?.repository
                        ?.revision?.branch ?? '',
                    commit:
                      component.spec.workflow.systemParameters?.repository
                        ?.revision?.commit,
                  },
                },
              },
              parameters: component.spec.workflow.parameters,
            }
          : undefined,
      } as ModelsComponent,
      namespaceName,
      projectName,
      {
        defaultOwner: this.defaultOwner,
        componentTypeUtils: this.componentTypeUtils,
        locationKey: `provider:${this.getProviderName()}`,
      },
      providesApis,
    );
  }

  /**
   * Translates a new API DeploymentPipeline to a Backstage DeploymentPipeline entity.
   */
  private translateNewDeploymentPipelineToEntity(
    pipeline: NewDeploymentPipeline,
    namespaceName: string,
    projectName: string,
  ): DeploymentPipelineEntityV1alpha1 {
    const pipelineName = getName(pipeline)!;

    const promotionPaths =
      pipeline.spec?.promotionPaths?.map(path => ({
        sourceEnvironment: path.sourceEnvironmentRef,
        targetEnvironments:
          path.targetEnvironmentRefs?.map(target => ({
            name: target.name,
            requiresApproval: target.requiresApproval,
            isManualApprovalRequired: target.isManualApprovalRequired,
          })) || [],
      })) || [];

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'DeploymentPipeline',
      metadata: {
        name: pipelineName,
        namespace: namespaceName,
        title: getDisplayName(pipeline) || pipelineName,
        description:
          getDescription(pipeline) ||
          `Deployment pipeline${projectName ? ` for ${projectName}` : ''}`,
        tags: ['openchoreo', 'deployment-pipeline', 'platform-engineering'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          ...(projectName && {
            [CHOREO_ANNOTATIONS.PROJECT]: projectName,
          }),
          ...(getCreatedAt(pipeline) && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(pipeline)!,
          }),
          [CHOREO_ANNOTATIONS.STATUS]: isReady(pipeline)
            ? 'Ready'
            : 'Not Ready',
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/deployment-pipeline': 'true',
        },
      },
      spec: {
        projectRefs: projectName ? [projectName] : [],
        namespaceName: namespaceName,
        promotionPaths,
      },
    };
  }

  /**
   * Translates a new API ComponentType to a Backstage ComponentType entity.
   */
  private translateNewComponentTypeToEntity(
    ct: NewComponentType,
    namespaceName: string,
  ): ComponentTypeEntityV1alpha1 {
    return translateCT(
      {
        name: getName(ct)!,
        displayName: getDisplayName(ct),
        description: getDescription(ct),
        workloadType: ct.spec?.workloadType,
        allowedWorkflows: ct.spec?.allowedWorkflows,
        allowedTraits: ct.spec?.allowedTraits,
        createdAt: getCreatedAt(ct),
      },
      namespaceName,
      { locationKey: this.getProviderName() },
    );
  }

  /**
   * Translates a new API Trait to a Backstage TraitType entity.
   */
  private translateNewTraitToEntity(
    trait: NewTrait,
    namespaceName: string,
  ): TraitTypeEntityV1alpha1 {
    return translateTrait(
      {
        name: getName(trait)!,
        displayName: getDisplayName(trait),
        description: getDescription(trait),
        createdAt: getCreatedAt(trait),
      },
      namespaceName,
      { locationKey: this.getProviderName() },
    );
  }

  /**
   * Translates a new API ClusterComponentType to a Backstage ClusterComponentType entity.
   */
  private translateNewClusterComponentTypeToEntity(
    cct: NewClusterComponentType,
  ): ClusterComponentTypeEntityV1alpha1 {
    return translateClusterCT(
      {
        name: getName(cct)!,
        displayName: getDisplayName(cct),
        description: getDescription(cct),
        workloadType: cct.spec?.workloadType,
        allowedWorkflows: cct.spec?.allowedWorkflows,
        allowedTraits: cct.spec?.allowedTraits,
        createdAt: getCreatedAt(cct),
      },
      { locationKey: this.getProviderName() },
    );
  }

  /**
   * Translates a new API ClusterTrait to a Backstage ClusterTraitType entity.
   */
  private translateNewClusterTraitToEntity(
    ct: NewClusterTrait,
  ): ClusterTraitTypeEntityV1alpha1 {
    return translateClusterTrait(
      {
        name: getName(ct)!,
        displayName: getDisplayName(ct),
        description: getDescription(ct),
        createdAt: getCreatedAt(ct),
      },
      { locationKey: this.getProviderName() },
    );
  }

  /**
   * Translates a new API ClusterDataPlane to a Backstage ClusterDataplane entity.
   */
  private translateNewClusterDataplaneToEntity(
    cdp: NewClusterDataPlane,
  ): ClusterDataplaneEntityV1alpha1 {
    const cdpName = getName(cdp)!;
    const gateway = cdp.spec?.gateway;
    const obsPlaneRef = cdp.spec?.observabilityPlaneRef;
    const obsRefName = obsPlaneRef?.name;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ClusterDataplane',
      metadata: {
        name: cdpName,
        namespace: 'openchoreo-cluster',
        title: getDisplayName(cdp) || cdpName,
        description: getDescription(cdp) || `${cdpName} cluster data plane`,
        tags: ['openchoreo', 'cluster-dataplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cdp) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(cdp) ? 'Ready' : 'Not Ready',
          'openchoreo.io/public-virtual-host':
            gateway?.ingress?.external?.http?.host || '',
          'openchoreo.io/namespace-virtual-host':
            gateway?.ingress?.internal?.http?.host || '',
          'openchoreo.io/public-http-port':
            gateway?.ingress?.external?.http?.port?.toString() || '',
          'openchoreo.io/public-https-port':
            gateway?.ingress?.external?.https?.port?.toString() || '',
          'openchoreo.io/namespace-http-port':
            gateway?.ingress?.internal?.http?.port?.toString() || '',
          'openchoreo.io/namespace-https-port':
            gateway?.ingress?.internal?.https?.port?.toString() || '',
          ...(obsRefName && {
            [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: obsRefName,
          }),
          ...this.mapNewAgentConnectionAnnotations(cdp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/cluster-dataplane': 'true',
        },
      },
      spec: {
        publicVirtualHost: gateway?.ingress?.external?.http?.host,
        namespaceVirtualHost: gateway?.ingress?.internal?.http?.host,
        publicHTTPPort: gateway?.ingress?.external?.http?.port,
        publicHTTPSPort: gateway?.ingress?.external?.https?.port,
        namespaceHTTPPort: gateway?.ingress?.internal?.http?.port,
        namespaceHTTPSPort: gateway?.ingress?.internal?.https?.port,
        observabilityPlaneRef: obsRefName,
      },
    };
  }

  /**
   * Translates a new API ClusterObservabilityPlane to a Backstage ClusterObservabilityPlane entity.
   */
  private translateNewClusterObservabilityPlaneToEntity(
    cop: NewClusterObservabilityPlane,
  ): ClusterObservabilityPlaneEntityV1alpha1 {
    const copName = getName(cop)!;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ClusterObservabilityPlane',
      metadata: {
        name: copName,
        namespace: 'openchoreo-cluster',
        title: getDisplayName(cop) || copName,
        description:
          getDescription(cop) || `${copName} cluster observability plane`,
        tags: ['openchoreo', 'cluster-observabilityplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cop) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(cop) ? 'Ready' : 'Not Ready',
          ...(cop.spec?.observerURL && {
            [CHOREO_ANNOTATIONS.OBSERVER_URL]: cop.spec.observerURL,
          }),
          ...this.mapNewAgentConnectionAnnotations(cop.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/cluster-observabilityplane': 'true',
        },
      },
      spec: {
        observerURL: cop.spec?.observerURL,
      },
    };
  }

  /**
   * Translates a new API ClusterBuildPlane to a Backstage ClusterBuildPlane entity.
   */
  private translateNewClusterBuildPlaneToEntity(
    cbp: NewClusterBuildPlane,
  ): ClusterBuildPlaneEntityV1alpha1 {
    const cbpName = getName(cbp)!;
    const obsPlaneRef = cbp.spec?.observabilityPlaneRef;
    const obsRefName = obsPlaneRef?.name;

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ClusterBuildPlane',
      metadata: {
        name: cbpName,
        namespace: 'openchoreo-cluster',
        title: getDisplayName(cbp) || cbpName,
        description: getDescription(cbp) || `${cbpName} cluster build plane`,
        tags: ['openchoreo', 'cluster-buildplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cbp) || '',
          [CHOREO_ANNOTATIONS.STATUS]: isReady(cbp) ? 'Ready' : 'Not Ready',
          ...(obsRefName && {
            [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: obsRefName,
          }),
          ...this.mapNewAgentConnectionAnnotations(cbp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/cluster-buildplane': 'true',
        },
      },
      spec: {
        observabilityPlaneRef: obsRefName,
      },
    };
  }

  /**
   * Applies buildPlaneRef fallback for projects without explicit buildPlaneRef.
   * For each System entity without BUILD_PLANE_REF annotation:
   *   1. If a BuildPlane exists in the same namespace → use it
   *   2. If no namespace BuildPlane but a ClusterBuildPlane named "default" exists → use that
   */
  private applyBuildPlaneFallback(
    allEntities: Entity[],
    clusterBuildPlaneNames: string[],
  ): void {
    const hasDefaultClusterBuildPlane =
      clusterBuildPlaneNames.includes('default');

    // Build a map of namespace -> deterministically chosen BuildPlane name
    const namespaceBuildPlanes = new Map<string, string[]>();
    for (const entity of allEntities) {
      if (entity.kind === 'BuildPlane' && entity.metadata.namespace) {
        const ns = entity.metadata.namespace;
        if (!namespaceBuildPlanes.has(ns)) {
          namespaceBuildPlanes.set(ns, []);
        }
        namespaceBuildPlanes.get(ns)!.push(entity.metadata.name);
      }
    }
    const namespacesWithBuildPlane = new Map<string, string>();
    namespaceBuildPlanes.forEach((names, ns) => {
      names.sort();
      namespacesWithBuildPlane.set(ns, names[0]);
    });

    for (const entity of allEntities) {
      if (entity.kind !== 'System') continue;

      const annotations = entity.metadata.annotations || {};
      if (annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF]) continue;

      const ns = entity.metadata.namespace || 'default';
      const nsBuildPlane = namespacesWithBuildPlane.get(ns);

      if (nsBuildPlane) {
        annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF] = nsBuildPlane;
        annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF_KIND] = 'BuildPlane';
        entity.metadata.annotations = annotations;
      } else if (hasDefaultClusterBuildPlane) {
        annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF] = 'default';
        annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF_KIND] =
          'ClusterBuildPlane';
        entity.metadata.annotations = annotations;
      }
    }
  }

  /**
   * Translates a new API Workflow to a Backstage Workflow entity.
   */
  private translateNewWorkflowToEntity(
    wf: NewWorkflow,
    namespaceName: string,
  ): WorkflowEntityV1alpha1 {
    const wfName = getName(wf)!;
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: wfName,
        namespace: namespaceName,
        title: getDisplayName(wf) || wfName,
        description: getDescription(wf) || `${wfName} workflow`,
        tags: ['openchoreo', 'workflow', 'platform-engineering'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(wf) || '',
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
        },
      },
      spec: {
        domain: `default/${namespaceName}`,
      },
    };
  }

  /**
   * Extracts workload endpoints from new API Workload resource.
   * Workload spec is Record<string, unknown>, endpoints live under spec.endpoints.
   */
  private extractWorkloadEndpoints(
    workload: NewWorkload,
  ): Record<string, WorkloadEndpoint> {
    const spec = workload.spec as
      | { endpoints?: Record<string, WorkloadEndpoint> }
      | undefined;
    const allEndpoints = spec?.endpoints || {};
    return Object.fromEntries(
      Object.entries(allEndpoints).filter(([, ep]) =>
        API_ENDPOINT_TYPES.has(ep.type),
      ),
    );
  }

  /**
   * Creates API entities from a new API Workload's endpoints.
   */
  private createApiEntitiesFromNewWorkload(
    componentName: string,
    endpoints: Record<string, WorkloadEndpoint>,
    namespaceName: string,
    projectName: string,
  ): Entity[] {
    const apiEntities: Entity[] = [];

    Object.entries(endpoints).forEach(([endpointName, endpoint]) => {
      const apiEntity: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: `${componentName}-${endpointName}`,
          namespace: namespaceName,
          title: `${componentName} ${endpointName} API`,
          description: `${endpoint.type} endpoint for ${componentName} service on port ${endpoint.port}`,
          tags: ['openchoreo', 'api', endpoint.type.toLowerCase()],
          annotations: {
            'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
            'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
            [CHOREO_ANNOTATIONS.COMPONENT]: componentName,
            [CHOREO_ANNOTATIONS.ENDPOINT_NAME]: endpointName,
            [CHOREO_ANNOTATIONS.ENDPOINT_TYPE]: endpoint.type,
            [CHOREO_ANNOTATIONS.ENDPOINT_PORT]: endpoint.port.toString(),
            [CHOREO_ANNOTATIONS.ENDPOINT_VISIBILITY]:
              endpoint.visibility?.join(',') ?? '',
            [CHOREO_ANNOTATIONS.PROJECT]: projectName,
            [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          },
          labels: {
            'openchoreo.io/managed': 'true',
          },
        },
        spec: {
          type: this.mapWorkloadEndpointTypeToBackstageType(endpoint.type),
          lifecycle: 'production',
          owner: this.defaultOwner,
          system: projectName,
          definition: this.createApiDefinitionFromWorkloadEndpoint(endpoint),
        },
      };

      apiEntities.push(apiEntity);
    });

    return apiEntities;
  }

  private normalizeObservabilityPlaneRef(
    ref: unknown,
    namespaceName: string,
  ): string {
    if (!ref) return '';
    let name: string;
    if (typeof ref === 'string') {
      name = ref;
    } else if (typeof ref === 'object' && ref !== null && 'name' in ref) {
      name = (ref as { name: string }).name;
    } else {
      return '';
    }
    // If the name already contains a namespace qualifier, return as-is
    if (name.includes('/')) return name;
    return `${namespaceName}/${name}`;
  }

  private mapWorkloadEndpointTypeToBackstageType(workloadType: string): string {
    switch (workloadType) {
      case 'REST':
      case 'HTTP':
        return 'openapi';
      case 'GraphQL':
        return 'graphql';
      case 'gRPC':
        return 'grpc';
      case 'Websocket':
        return 'asyncapi';
      case 'TCP':
      case 'UDP':
        return 'openapi'; // Default to openapi for TCP/UDP
      default:
        return 'openapi';
    }
  }

  private createApiDefinitionFromWorkloadEndpoint(
    endpoint: WorkloadEndpoint,
  ): string {
    if (endpoint.schema?.content) {
      return endpoint.schema.content;
    }
    return 'No schema available';
  }
}
