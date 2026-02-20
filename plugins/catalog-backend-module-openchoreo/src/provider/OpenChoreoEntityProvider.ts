import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  fetchAllPages,
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  isReady,
  type OpenChoreoLegacyComponents,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

// Use generated types from OpenAPI spec
type ModelsProject = OpenChoreoLegacyComponents['schemas']['ProjectResponse'];
type ModelsNamespace =
  OpenChoreoLegacyComponents['schemas']['NamespaceResponse'];
type ModelsComponent =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];
type ModelsEnvironment =
  OpenChoreoLegacyComponents['schemas']['EnvironmentResponse'];
type ModelsDataPlane =
  OpenChoreoLegacyComponents['schemas']['DataPlaneResponse'];
type ModelsBuildPlane =
  OpenChoreoLegacyComponents['schemas']['BuildPlaneResponse'];
type ModelsObservabilityPlane =
  OpenChoreoLegacyComponents['schemas']['ObservabilityPlaneResponse'];
type ModelsCompleteComponent =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];
type ModelsDeploymentPipeline =
  OpenChoreoLegacyComponents['schemas']['DeploymentPipelineResponse'];
type ModelsAgentConnectionStatus =
  OpenChoreoLegacyComponents['schemas']['AgentConnectionStatusResponse'];
type ModelsComponentType =
  OpenChoreoLegacyComponents['schemas']['ComponentTypeResponse'];
type ModelsWorkflow = OpenChoreoLegacyComponents['schemas']['WorkflowResponse'];
type ModelsTrait = OpenChoreoLegacyComponents['schemas']['TraitResponse'];

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
type NewWorkflow = OpenChoreoComponents['schemas']['Workflow'];
type NewComponentWorkflowTemplate =
  OpenChoreoComponents['schemas']['ComponentWorkflowTemplate'];
type NewWorkload = OpenChoreoComponents['schemas']['Workload'];
type NewAgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];

// WorkloadEndpoint is part of the workload.endpoints structure
// Since Workload uses additionalProperties, we define this locally
interface WorkloadEndpoint {
  type: string;
  port: number;
  visibility: string;
  schema?: {
    content?: string;
  };
}
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
  ComponentWorkflowEntityV1alpha1,
} from '../kinds';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import {
  translateComponentToEntity as translateComponent,
  translateProjectToEntity as translateProject,
  translateEnvironmentToEntity as translateEnvironment,
  translateComponentTypeToEntity as translateCT,
  translateTraitToEntity as translateTrait,
  translateComponentWorkflowToEntity as translateCW,
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
  private readonly useNewApi: boolean;

  constructor(
    taskRunner: SchedulerServiceTaskRunner,
    logger: LoggerService,
    config: Config,
    tokenService?: OpenChoreoTokenService,
    useNewApi?: boolean,
  ) {
    this.taskRunner = taskRunner;
    this.logger = logger;
    this.baseUrl = config.getString('openchoreo.baseUrl');
    this.tokenService = tokenService;
    this.useNewApi = useNewApi ?? false;
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

    if (this.useNewApi) {
      return this.runNew();
    }
    return this.runLegacy();
  }

  private async runLegacy(): Promise<void> {
    try {
      this.logger.info('Fetching namespaces and projects from OpenChoreo API');

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

      // Create client instance with service token
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // First, get all namespaces
      const {
        data: nsData,
        error: nsError,
        response: nsResponse,
      } = await client.GET('/namespaces');

      if (nsError || !nsResponse.ok) {
        throw new Error(
          `Failed to fetch namespaces: ${nsResponse.status} ${nsResponse.statusText}`,
        );
      }

      if (!nsData.success || !nsData.data?.items) {
        throw new Error('Failed to retrieve namespace list');
      }

      const namespaces = nsData.data.items as ModelsNamespace[];
      this.logger.debug(
        `Found ${namespaces.length} namespaces from OpenChoreo`,
      );

      const allEntities: Entity[] = [];

      // Create Domain entities for each namespace
      const domainEntities: Entity[] = namespaces.map(ns =>
        this.translateNamespaceToDomain(ns),
      );
      allEntities.push(...domainEntities);

      // Get environments for each namespace and create Environment entities
      for (const ns of namespaces) {
        try {
          const {
            data: envData,
            error: envError,
            response: envResponse,
          } = await client.GET('/namespaces/{namespaceName}/environments', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (envError || !envResponse.ok) {
            this.logger.warn(
              `Failed to fetch environments for namespace ${ns.name}: ${envResponse.status}`,
            );
            continue;
          }

          const environments =
            envData.success && envData.data?.items
              ? (envData.data.items as ModelsEnvironment[])
              : [];
          this.logger.debug(
            `Found ${environments.length} environments in namespace: ${ns.name}`,
          );

          const environmentEntities: Entity[] = environments.map(environment =>
            this.translateEnvironmentToEntity(environment, ns.name!),
          );
          allEntities.push(...environmentEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch environments for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get dataplanes for each namespace and create Dataplane entities
      for (const ns of namespaces) {
        try {
          const {
            data: dpData,
            error: dpError,
            response: dpResponse,
          } = await client.GET('/namespaces/{namespaceName}/dataplanes', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (dpError || !dpResponse.ok) {
            this.logger.warn(
              `Failed to fetch dataplanes for namespace ${ns.name}: ${dpResponse.status}`,
            );
            continue;
          }

          const dataplanes =
            dpData.success && dpData.data?.items
              ? (dpData.data.items as ModelsDataPlane[])
              : [];
          this.logger.debug(
            `Found ${dataplanes.length} dataplanes in namespace: ${ns.name}`,
          );

          const dataplaneEntities: Entity[] = dataplanes.map(dataplane =>
            this.translateDataplaneToEntity(dataplane, ns.name!),
          );
          allEntities.push(...dataplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch dataplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get buildplanes for each namespace and create BuildPlane entities
      for (const ns of namespaces) {
        try {
          const {
            data: bpData,
            error: bpError,
            response: bpResponse,
          } = await client.GET('/namespaces/{namespaceName}/buildplanes', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (bpError || !bpResponse.ok) {
            this.logger.warn(
              `Failed to fetch buildplanes for namespace ${ns.name}: ${bpResponse.status}`,
            );
            continue;
          }

          // BuildPlanes use writeSuccessResponse — data is direct array
          const buildplanes =
            bpData.success && bpData.data
              ? (bpData.data as ModelsBuildPlane[])
              : [];
          this.logger.debug(
            `Found ${buildplanes.length} buildplanes in namespace: ${ns.name}`,
          );

          const buildplaneEntities: Entity[] = buildplanes.map(buildplane =>
            this.translateBuildPlaneToEntity(buildplane, ns.name!),
          );
          allEntities.push(...buildplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch buildplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get observabilityplanes for each namespace and create ObservabilityPlane entities
      for (const ns of namespaces) {
        try {
          const {
            data: opData,
            error: opError,
            response: opResponse,
          } = await client.GET(
            '/namespaces/{namespaceName}/observabilityplanes',
            {
              params: {
                path: { namespaceName: ns.name! },
              },
            },
          );

          if (opError || !opResponse.ok) {
            this.logger.warn(
              `Failed to fetch observabilityplanes for namespace ${ns.name}: ${opResponse.status}`,
            );
            continue;
          }

          // ObservabilityPlanes use writeSuccessResponse — data is direct array
          const observabilityplanes =
            opData.success && opData.data
              ? (opData.data as ModelsObservabilityPlane[])
              : [];
          this.logger.debug(
            `Found ${observabilityplanes.length} observabilityplanes in namespace: ${ns.name}`,
          );

          const observabilityplaneEntities: Entity[] = observabilityplanes.map(
            obsplane =>
              this.translateObservabilityPlaneToEntity(obsplane, ns.name!),
          );
          allEntities.push(...observabilityplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch observabilityplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get projects for each namespace and create System entities
      for (const ns of namespaces) {
        try {
          const {
            data: projData,
            error: projError,
            response: projResponse,
          } = await client.GET('/namespaces/{namespaceName}/projects', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (projError || !projResponse.ok) {
            this.logger.warn(
              `Failed to fetch projects for namespace ${ns.name}: ${projResponse.status}`,
            );
            continue;
          }

          const projects =
            projData.success && projData.data?.items
              ? (projData.data.items as ModelsProject[])
              : [];
          this.logger.debug(
            `Found ${projects.length} projects in namespace: ${ns.name}`,
          );

          // Filter out projects marked for deletion
          const activeProjects = projects.filter(
            project => !project.deletionTimestamp,
          );
          if (projects.length !== activeProjects.length) {
            this.logger.debug(
              `Filtered out ${
                projects.length - activeProjects.length
              } deleted projects in namespace: ${ns.name}`,
            );
          }

          const systemEntities: Entity[] = activeProjects.map(project =>
            this.translateProjectToEntity(project, ns.name!),
          );
          allEntities.push(...systemEntities);

          // Deduplicate deployment pipelines across projects:
          // Multiple projects may reference the same pipeline (same kind/namespace/name),
          // so we collect all projectRefs into a single entity per pipeline.
          const pipelineMap = new Map<
            string,
            DeploymentPipelineEntityV1alpha1
          >();

          // Get deployment pipelines and components for each project
          for (const project of projects) {
            // Fetch deployment pipeline for the project
            try {
              const {
                data: pipelineData,
                error: pipelineError,
                response: pipelineResponse,
              } = await client.GET(
                '/namespaces/{namespaceName}/projects/{projectName}/deployment-pipeline',
                {
                  params: {
                    path: {
                      namespaceName: ns.name!,
                      projectName: project.name!,
                    },
                  },
                },
              );

              if (
                !pipelineError &&
                pipelineResponse.ok &&
                pipelineData?.success &&
                pipelineData?.data
              ) {
                const pipeline = pipelineData.data as ModelsDeploymentPipeline;
                const pipelineKey = `${ns.name!}/${pipeline.name}`;
                const existing = pipelineMap.get(pipelineKey);

                if (existing) {
                  // Pipeline already seen from another project — append this project ref
                  if (!existing.spec.projectRefs?.includes(project.name!)) {
                    existing.spec.projectRefs = [
                      ...(existing.spec.projectRefs || []),
                      project.name!,
                    ];
                  }
                  this.logger.debug(
                    `Added project ${project.name} to existing pipeline entity: ${pipeline.name}`,
                  );
                } else {
                  const pipelineEntity =
                    this.translateDeploymentPipelineToEntity(
                      pipeline,
                      ns.name!,
                      project.name!,
                    );
                  pipelineMap.set(pipelineKey, pipelineEntity);
                  this.logger.debug(
                    `Created deployment pipeline entity for project: ${project.name}`,
                  );
                }
              } else {
                this.logger.debug(
                  `No deployment pipeline found for project ${project.name}`,
                );
              }
            } catch (error) {
              this.logger.debug(
                `Failed to fetch deployment pipeline for project ${project.name}: ${error}`,
              );
            }

            // Get components for the project and create Component entities
            try {
              const {
                data: compData,
                error: compError,
                response: compResponse,
              } = await client.GET(
                '/namespaces/{namespaceName}/projects/{projectName}/components',
                {
                  params: {
                    path: {
                      namespaceName: ns.name!,
                      projectName: project.name!,
                    },
                  },
                },
              );

              if (compError || !compResponse.ok) {
                this.logger.warn(
                  `Failed to fetch components for project ${project.name}: ${compResponse.status}`,
                );
                continue;
              }

              const components =
                compData.success && compData.data?.items
                  ? (compData.data.items as ModelsComponent[])
                  : [];
              this.logger.debug(
                `Found ${components.length} components in project: ${project.name}`,
              );

              // Filter out components marked for deletion
              const activeComponents = components.filter(
                component => !component.deletionTimestamp,
              );
              if (components.length !== activeComponents.length) {
                this.logger.debug(
                  `Filtered out ${
                    components.length - activeComponents.length
                  } deleted components in project: ${project.name}`,
                );
              }

              for (const component of activeComponents) {
                // If the component is a Service (has endpoints), fetch complete details and create both component and API entities
                const pageVariant = this.componentTypeUtils.getPageVariant(
                  component.type || '',
                );
                if (pageVariant === 'service') {
                  try {
                    const {
                      data: detailData,
                      error: detailError,
                      response: detailResponse,
                    } = await client.GET(
                      '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}',
                      {
                        params: {
                          path: {
                            namespaceName: ns.name!,
                            projectName: project.name!,
                            componentName: component.name!,
                          },
                          query: {
                            include: 'workload',
                          },
                        },
                      },
                    );

                    if (
                      detailError ||
                      !detailResponse.ok ||
                      !detailData.success ||
                      !detailData.data
                    ) {
                      this.logger.warn(
                        `Failed to fetch complete component details for ${component.name}: ${detailResponse.status}`,
                      );
                      // Fallback to basic component entity
                      const componentEntity = this.translateComponentToEntity(
                        component,
                        ns.name!,
                        project.name!,
                      );
                      allEntities.push(componentEntity);
                      continue;
                    }

                    const completeComponent = detailData.data;

                    // Create component entity with providesApis
                    const componentEntity =
                      this.translateServiceComponentToEntity(
                        completeComponent,
                        ns.name!,
                        project.name!,
                      );
                    allEntities.push(componentEntity);

                    // Create API entities if endpoints exist
                    if (completeComponent.workload?.endpoints) {
                      const apiEntities = this.createApiEntitiesFromWorkload(
                        completeComponent,
                        ns.name!,
                        project.name!,
                      );
                      allEntities.push(...apiEntities);
                    }
                  } catch (error) {
                    this.logger.warn(
                      `Failed to fetch complete component details for ${component.name}: ${error}`,
                    );
                    // Fallback to basic component entity
                    const componentEntity = this.translateComponentToEntity(
                      component,
                      ns.name!,
                      project.name!,
                    );
                    allEntities.push(componentEntity);
                  }
                } else {
                  // Create basic component entity for non-Service components
                  const componentEntity = this.translateComponentToEntity(
                    component,
                    ns.name!,
                    project.name!,
                  );
                  allEntities.push(componentEntity);
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch components for project ${project.name} in namespace ${ns.name}: ${error}`,
              );
            }
          }

          // Add all deduplicated pipeline entities for this namespace
          allEntities.push(...pipelineMap.values());
        } catch (error) {
          this.logger.warn(
            `Failed to fetch projects for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Fetch Component Type Definitions and generate Template entities
      // Use the new two-step API: list + schema for each CTD
      for (const ns of namespaces) {
        try {
          this.logger.info(
            `Fetching Component Type Definitions from OpenChoreo API for namespace: ${ns.name}`,
          );

          // Step 1: List CTDs (complete metadata including allowedWorkflows)
          const {
            data: listData,
            error: listError,
            response: listResponse,
          } = await client.GET('/namespaces/{namespaceName}/component-types', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (
            listError ||
            !listResponse.ok ||
            !listData.success ||
            !listData.data?.items
          ) {
            this.logger.warn(
              `Failed to fetch component types for namespace ${ns.name}: ${listResponse.status}`,
            );
            continue;
          }

          const componentTypeItems = listData.data
            .items as OpenChoreoLegacyComponents['schemas']['ComponentTypeResponse'][];
          this.logger.debug(
            `Found ${componentTypeItems.length} CTDs in namespace: ${ns.name} (total: ${listData.data.totalCount})`,
          );

          // Step 2: Fetch schemas in parallel for better performance
          const ctdsWithSchemas = await Promise.all(
            componentTypeItems.map(async listItem => {
              try {
                const {
                  data: schemaData,
                  error: schemaError,
                  response: schemaResponse,
                } = await client.GET(
                  '/namespaces/{namespaceName}/component-types/{ctName}/schema',
                  {
                    params: {
                      path: { namespaceName: ns.name!, ctName: listItem.name! },
                    },
                  },
                );

                if (
                  schemaError ||
                  !schemaResponse.ok ||
                  !schemaData?.success ||
                  !schemaData?.data
                ) {
                  this.logger.warn(
                    `Failed to fetch schema for CTD ${listItem.name} in namespace ${ns.name}: ${schemaResponse.status}`,
                  );
                  return null;
                }

                // Combine metadata from list item + schema into full ComponentType object
                const fullComponentType = {
                  metadata: {
                    name: listItem.name!,
                    displayName: listItem.displayName,
                    description: listItem.description,
                    workloadType: listItem.workloadType!,
                    allowedWorkflows: listItem.allowedWorkflows,
                    allowedTraits: listItem.allowedTraits,
                    createdAt: listItem.createdAt!,
                  },
                  spec: {
                    inputParametersSchema: schemaData!.data as any,
                  },
                };

                return fullComponentType;
              } catch (error) {
                this.logger.warn(
                  `Failed to fetch schema for CTD ${listItem.name} in namespace ${ns.name}: ${error}`,
                );
                return null;
              }
            }),
          );

          // Filter out failed schema fetches
          const validCTDs = ctdsWithSchemas.filter(
            (ctd): ctd is NonNullable<typeof ctd> => ctd !== null,
          );

          // Step 3: Convert CTDs to template entities
          const templateEntities: Entity[] = validCTDs
            .map(ctd => {
              try {
                const templateEntity =
                  this.ctdConverter.convertCtdToTemplateEntity(ctd, ns.name!);
                // Add the required Backstage catalog annotations
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
            `Successfully generated ${templateEntities.length} template entities from CTDs in namespace: ${ns.name}`,
          );

          // Also generate ComponentType entities for PE catalog listing
          const componentTypeEntities = componentTypeItems
            .map(ctItem => {
              try {
                return this.translateComponentTypeToEntity(
                  ctItem,
                  ns.name!,
                ) as Entity;
              } catch (error) {
                this.logger.warn(
                  `Failed to translate ComponentType ${ctItem.name}: ${error}`,
                );
                return null;
              }
            })
            .filter((entity): entity is Entity => entity !== null);

          allEntities.push(...componentTypeEntities);
          this.logger.debug(
            `Generated ${componentTypeEntities.length} ComponentType entities in namespace: ${ns.name}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch Component Type Definitions for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get traits for each namespace and create TraitType entities
      for (const ns of namespaces) {
        try {
          const {
            data: traitData,
            error: traitError,
            response: traitResponse,
          } = await client.GET('/namespaces/{namespaceName}/traits', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (traitError || !traitResponse.ok) {
            this.logger.warn(
              `Failed to fetch traits for namespace ${ns.name}: ${traitResponse.status}`,
            );
            continue;
          }

          const traits =
            traitData.success && traitData.data?.items
              ? (traitData.data.items as ModelsTrait[])
              : [];
          this.logger.debug(
            `Found ${traits.length} traits in namespace: ${ns.name}`,
          );

          const traitEntities: Entity[] = traits.map(trait =>
            this.translateTraitToEntity(trait, ns.name!),
          );
          allEntities.push(...traitEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch traits for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get workflows for each namespace and create Workflow entities
      for (const ns of namespaces) {
        try {
          const {
            data: wfData,
            error: wfError,
            response: wfResponse,
          } = await client.GET('/namespaces/{namespaceName}/workflows', {
            params: {
              path: { namespaceName: ns.name! },
            },
          });

          if (wfError || !wfResponse.ok) {
            this.logger.warn(
              `Failed to fetch workflows for namespace ${ns.name}: ${wfResponse.status}`,
            );
            continue;
          }

          const workflows =
            wfData.success && wfData.data?.items
              ? (wfData.data.items as ModelsWorkflow[])
              : [];
          this.logger.debug(
            `Found ${workflows.length} workflows in namespace: ${ns.name}`,
          );

          const workflowEntities: Entity[] = workflows.map(workflow =>
            this.translateWorkflowToEntity(workflow, ns.name!),
          );
          allEntities.push(...workflowEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch workflows for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get component workflows for each namespace and create ComponentWorkflow entities
      for (const ns of namespaces) {
        try {
          const {
            data: cwData,
            error: cwError,
            response: cwResponse,
          } = await client.GET(
            '/namespaces/{namespaceName}/component-workflows',
            {
              params: {
                path: { namespaceName: ns.name! },
              },
            },
          );

          if (cwError || !cwResponse.ok) {
            this.logger.warn(
              `Failed to fetch component workflows for namespace ${ns.name}: ${cwResponse.status}`,
            );
            continue;
          }

          const componentWorkflows =
            cwData.success && cwData.data?.items
              ? (cwData.data.items as ModelsWorkflow[])
              : [];
          this.logger.debug(
            `Found ${componentWorkflows.length} component workflows in namespace: ${ns.name}`,
          );

          const cwEntities: Entity[] = componentWorkflows.map(cw =>
            this.translateComponentWorkflowToEntity(cw, ns.name!),
          );
          allEntities.push(...cwEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch component workflows for namespace ${ns.name}: ${error}`,
          );
        }
      }

      await this.connection!.applyMutation({
        type: 'full',
        entities: allEntities.map(entity => ({
          entity,
          locationKey: `provider:${this.getProviderName()}`,
        })),
      });

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
      const workflowCount = allEntities.filter(
        e => e.kind === 'Workflow',
      ).length;
      const componentWorkflowCount = allEntities.filter(
        e => e.kind === 'ComponentWorkflow',
      ).length;
      this.logger.info(
        `Successfully processed ${allEntities.length} entities (${domainEntities.length} domains, ${systemCount} systems, ${componentCount} components, ${apiCount} apis, ${environmentCount} environments, ${dataplaneCount} dataplanes, ${buildplaneCount} buildplanes, ${observabilityplaneCount} observabilityplanes, ${pipelineCount} deployment pipelines, ${componentTypeCount} component types, ${traitTypeCount} trait types, ${workflowCount} workflows, ${componentWorkflowCount} component workflows)`,
      );
    } catch (error) {
      this.logger.error(`Failed to run OpenChoreoEntityProvider: ${error}`);
    }
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
            if (res.error) throw new Error('Failed to fetch namespaces');
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
        try {
          const environments = await fetchAllPages<NewEnvironment>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/environments', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch environments for ${ns.name}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${environments.length} environments in namespace: ${ns.name}`,
          );

          const environmentEntities: Entity[] = environments.map(env =>
            this.translateNewEnvironmentToEntity(env, ns.name),
          );
          allEntities.push(...environmentEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch environments for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get dataplanes for each namespace
      for (const ns of namespaces) {
        try {
          const dataplanes = await fetchAllPages<NewDataPlane>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/dataplanes', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch dataplanes for ${ns.name}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${dataplanes.length} dataplanes in namespace: ${ns.name}`,
          );

          const dataplaneEntities: Entity[] = dataplanes.map(dp =>
            this.translateNewDataplaneToEntity(dp, ns.name),
          );
          allEntities.push(...dataplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch dataplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get buildplanes for each namespace
      for (const ns of namespaces) {
        try {
          const buildplanes = await fetchAllPages<NewBuildPlane>(() =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/buildplanes', {
                params: {
                  path: { namespaceName: ns.name },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch buildplanes for ${ns.name}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${buildplanes.length} buildplanes in namespace: ${ns.name}`,
          );

          const buildplaneEntities: Entity[] = buildplanes.map(bp =>
            this.translateNewBuildPlaneToEntity(bp, ns.name),
          );
          allEntities.push(...buildplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch buildplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get observabilityplanes for each namespace
      for (const ns of namespaces) {
        try {
          const observabilityplanes =
            await fetchAllPages<NewObservabilityPlane>(() =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/observabilityplanes', {
                  params: {
                    path: { namespaceName: ns.name },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch observabilityplanes for ${ns.name}`,
                    );
                  return res.data;
                }),
            );

          this.logger.debug(
            `Found ${observabilityplanes.length} observabilityplanes in namespace: ${ns.name}`,
          );

          const observabilityplaneEntities: Entity[] = observabilityplanes.map(
            op => this.translateNewObservabilityPlaneToEntity(op, ns.name),
          );
          allEntities.push(...observabilityplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch observabilityplanes for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get projects for each namespace and create System entities
      for (const ns of namespaces) {
        try {
          const projects = await fetchAllPages<NewProject>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/projects', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch projects for ${ns.name}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${projects.length} projects in namespace: ${ns.name}`,
          );

          // New API does not return deleted resources, no filtering needed
          const systemEntities: Entity[] = projects.map(project =>
            this.translateNewProjectToEntity(project, ns.name),
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
                .GET(
                  '/api/v1/namespaces/{namespaceName}/deployment-pipelines',
                  {
                    params: {
                      path: { namespaceName: ns.name },
                    },
                  },
                )
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch deployment pipelines for ${ns.name}`,
                    );
                  return res.data;
                }),
            );

            // Match pipelines to projects via project.spec.deploymentPipelineRef
            for (const pipeline of pipelines) {
              const pipelineName = getName(pipeline)!;
              const pipelineKey = `${ns.name}/${pipelineName}`;

              // Find all projects that reference this pipeline
              const referencingProjects = projects.filter(
                p => p.spec?.deploymentPipelineRef === pipelineName,
              );

              if (referencingProjects.length > 0) {
                const firstProjectName = getName(referencingProjects[0])!;
                const pipelineEntity =
                  this.translateNewDeploymentPipelineToEntity(
                    pipeline,
                    ns.name,
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
                    ns.name,
                    '',
                  );
                pipelineMap.set(pipelineKey, pipelineEntity);
              }
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch deployment pipelines for namespace ${ns.name}: ${error}`,
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
                      path: { namespaceName: ns.name },
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
                const componentType =
                  component.spec?.type ?? component.spec?.componentType ?? '';

                // If the component is a Service (has endpoints), fetch workload
                const pageVariant =
                  this.componentTypeUtils.getPageVariant(componentType);
                if (pageVariant === 'service') {
                  try {
                    const { data: workloadData, error: workloadError } =
                      await client.GET(
                        '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
                        {
                          params: {
                            path: {
                              namespaceName: ns.name,
                              workloadName: componentName,
                            },
                          },
                        },
                      );

                    if (!workloadError && workloadData) {
                      // Create component entity with providesApis
                      const endpoints =
                        this.extractWorkloadEndpoints(workloadData);
                      const providesApis = Object.keys(endpoints).map(
                        epName => `${componentName}-${epName}`,
                      );

                      const componentEntity =
                        this.translateNewComponentToEntity(
                          component,
                          ns.name,
                          projectName,
                          providesApis,
                        );
                      allEntities.push(componentEntity);

                      // Create API entities from workload endpoints
                      const apiEntities = this.createApiEntitiesFromNewWorkload(
                        componentName,
                        endpoints,
                        ns.name,
                        projectName,
                      );
                      allEntities.push(...apiEntities);
                    } else {
                      // Workload not found — fallback to basic component entity
                      const componentEntity =
                        this.translateNewComponentToEntity(
                          component,
                          ns.name,
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
                      ns.name,
                      projectName,
                    );
                    allEntities.push(componentEntity);
                  }
                } else {
                  // Create basic component entity for non-Service components
                  const componentEntity = this.translateNewComponentToEntity(
                    component,
                    ns.name,
                    projectName,
                  );
                  allEntities.push(componentEntity);
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch components for project ${projectName} in namespace ${ns.name}: ${error}`,
              );
            }
          }

          // Add all deduplicated pipeline entities for this namespace
          allEntities.push(...pipelineMap.values());
        } catch (error) {
          this.logger.warn(
            `Failed to fetch projects for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Fetch Component Type Definitions and generate Template entities
      for (const ns of namespaces) {
        try {
          this.logger.info(
            `Fetching Component Type Definitions from OpenChoreo API for namespace: ${ns.name}`,
          );

          const componentTypes = await fetchAllPages<NewComponentType>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/component-types', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(
                    `Failed to fetch component types for ${ns.name}`,
                  );
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${componentTypes.length} CTDs in namespace: ${ns.name}`,
          );

          // Fetch schemas in parallel for better performance
          const ctdsWithSchemas = await Promise.all(
            componentTypes.map(async ct => {
              const ctName = getName(ct);
              if (!ctName) return null;
              try {
                const { data: schemaData, error: schemaError } =
                  await client.GET(
                    '/api/v1/namespaces/{namespaceName}/component-types/{ctName}/schema',
                    {
                      params: {
                        path: { namespaceName: ns.name, ctName },
                      },
                    },
                  );

                if (schemaError || !schemaData) {
                  this.logger.warn(
                    `Failed to fetch schema for CTD ${ctName} in namespace ${ns.name}`,
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
                    allowedTraits: ct.spec?.allowedTraits?.map(t => ({
                      name: t,
                    })),
                    createdAt: getCreatedAt(ct) || '',
                  },
                  spec: {
                    inputParametersSchema: schemaData as any,
                  },
                };

                return fullComponentType;
              } catch (error) {
                this.logger.warn(
                  `Failed to fetch schema for CTD ${ctName} in namespace ${ns.name}: ${error}`,
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
                  this.ctdConverter.convertCtdToTemplateEntity(ctd, ns.name);
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
            `Successfully generated ${templateEntities.length} template entities from CTDs in namespace: ${ns.name}`,
          );

          // Also generate ComponentType entities
          const componentTypeEntities = componentTypes
            .map(ct => {
              try {
                return this.translateNewComponentTypeToEntity(
                  ct,
                  ns.name,
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
            `Generated ${componentTypeEntities.length} ComponentType entities in namespace: ${ns.name}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch Component Type Definitions for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get traits for each namespace
      for (const ns of namespaces) {
        try {
          const traits = await fetchAllPages<NewTrait>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/traits', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch traits for ${ns.name}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${traits.length} traits in namespace: ${ns.name}`,
          );

          const traitEntities: Entity[] = traits.map(trait =>
            this.translateNewTraitToEntity(trait, ns.name),
          );
          allEntities.push(...traitEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch traits for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get workflows for each namespace
      for (const ns of namespaces) {
        try {
          const workflows = await fetchAllPages<NewWorkflow>(cursor =>
            client
              .GET('/api/v1/namespaces/{namespaceName}/workflows', {
                params: {
                  path: { namespaceName: ns.name },
                  query: { limit: 100, cursor },
                },
              })
              .then(res => {
                if (res.error)
                  throw new Error(`Failed to fetch workflows for ${ns.name}`);
                return res.data;
              }),
          );

          this.logger.debug(
            `Found ${workflows.length} workflows in namespace: ${ns.name}`,
          );

          const workflowEntities: Entity[] = workflows.map(wf =>
            this.translateNewWorkflowToEntity(wf, ns.name),
          );
          allEntities.push(...workflowEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch workflows for namespace ${ns.name}: ${error}`,
          );
        }
      }

      // Get component workflows for each namespace
      for (const ns of namespaces) {
        try {
          const componentWorkflows =
            await fetchAllPages<NewComponentWorkflowTemplate>(cursor =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/component-workflows', {
                  params: {
                    path: { namespaceName: ns.name },
                    query: { limit: 100, cursor },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error(
                      `Failed to fetch component workflows for ${ns.name}`,
                    );
                  return res.data;
                }),
            );

          this.logger.debug(
            `Found ${componentWorkflows.length} component workflows in namespace: ${ns.name}`,
          );

          // ComponentWorkflowTemplate is flat (name, displayName, description, createdAt)
          // — same shape as legacy, reuse translateComponentWorkflowToEntity
          const cwEntities: Entity[] = componentWorkflows.map(cw =>
            this.translateComponentWorkflowToEntity(cw, ns.name),
          );
          allEntities.push(...cwEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch component workflows for namespace ${ns.name}: ${error}`,
          );
        }
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
    const workflowCount = allEntities.filter(e => e.kind === 'Workflow').length;
    const componentWorkflowCount = allEntities.filter(
      e => e.kind === 'ComponentWorkflow',
    ).length;
    this.logger.info(
      `Successfully processed ${allEntities.length} entities (${domainCount} domains, ${systemCount} systems, ${componentCount} components, ${apiCount} apis, ${environmentCount} environments, ${dataplaneCount} dataplanes, ${buildplaneCount} buildplanes, ${observabilityplaneCount} observabilityplanes, ${pipelineCount} deployment pipelines, ${componentTypeCount} component types, ${traitTypeCount} trait types, ${workflowCount} workflows, ${componentWorkflowCount} component workflows)`,
    );
  }

  /**
   * Translates a ModelsNamespace from OpenChoreo API to a Backstage Domain entity
   */
  private translateNamespaceToDomain(
    namespace: ModelsNamespace | NewNamespace,
  ): Entity {
    const domainEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Domain',
      metadata: {
        name: namespace.name,
        title: namespace.displayName || namespace.name,
        description: namespace.description || namespace.name,
        // namespace: 'default',
        tags: ['openchoreo', 'namespace', 'domain'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespace.name,
          ...(namespace.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: namespace.createdAt,
          }),
          ...(namespace.status && {
            [CHOREO_ANNOTATIONS.STATUS]: namespace.status,
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

  /**
   * Translates a ModelsProject from OpenChoreo API to a Backstage System entity
   */
  private translateProjectToEntity(
    project: ModelsProject,
    namespaceName: string,
  ): Entity {
    return translateProject(project, namespaceName, {
      locationKey: this.getProviderName(),
      defaultOwner: this.defaultOwner,
    });
  }

  /**
   * Translates a ModelsEnvironment from OpenChoreo API to a Backstage Environment entity
   */
  private translateEnvironmentToEntity(
    environment: ModelsEnvironment,
    namespaceName: string,
  ): EnvironmentEntityV1alpha1 {
    return translateEnvironment(environment, namespaceName, {
      locationKey: this.getProviderName(),
    });
  }

  /**
   * Translates a ModelsDataPlane from OpenChoreo API to a Backstage Dataplane entity
   */
  private translateDataplaneToEntity(
    dataplane: ModelsDataPlane,
    namespaceName: string,
  ): DataplaneEntityV1alpha1 {
    const dataplaneEntity: DataplaneEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Dataplane',
      metadata: {
        name: dataplane.name,
        namespace: namespaceName,
        title: dataplane.displayName || dataplane.name,
        description: dataplane.description || `${dataplane.name} dataplane`,
        tags: ['openchoreo', 'dataplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: dataplane.createdAt || '',
          [CHOREO_ANNOTATIONS.STATUS]: dataplane.status || '',
          'openchoreo.io/public-virtual-host':
            dataplane.publicVirtualHost || '',
          'openchoreo.io/namespace-virtual-host':
            dataplane.namespaceVirtualHost || '',
          'openchoreo.io/public-http-port':
            dataplane.publicHTTPPort?.toString() || '',
          'openchoreo.io/public-https-port':
            dataplane.publicHTTPSPort?.toString() || '',
          'openchoreo.io/namespace-http-port':
            dataplane.namespaceHTTPPort?.toString() || '',
          'openchoreo.io/namespace-https-port':
            dataplane.namespaceHTTPSPort?.toString() || '',
          'openchoreo.io/observability-plane-ref':
            this.normalizeObservabilityPlaneRef(
              dataplane.observabilityPlaneRef,
              namespaceName,
            ),
          ...this.mapAgentConnectionAnnotations(dataplane.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/dataplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
        // Domain entities (mapped from OpenChoreo namespaces) live in the Backstage 'default' namespace
        domain: `default/${namespaceName}`,
        publicVirtualHost: dataplane.publicVirtualHost,
        namespaceVirtualHost: dataplane.namespaceVirtualHost,
        publicHTTPPort: dataplane.publicHTTPPort,
        publicHTTPSPort: dataplane.publicHTTPSPort,
        namespaceHTTPPort: dataplane.namespaceHTTPPort,
        namespaceHTTPSPort: dataplane.namespaceHTTPSPort,
        observabilityPlaneRef: this.normalizeObservabilityPlaneRef(
          dataplane.observabilityPlaneRef,
          namespaceName,
        ),
      },
    };

    return dataplaneEntity;
  }

  /**
   * Translates a ModelsBuildPlane from OpenChoreo API to a Backstage BuildPlane entity
   */
  private translateBuildPlaneToEntity(
    buildplane: ModelsBuildPlane,
    namespaceName: string,
  ): BuildPlaneEntityV1alpha1 {
    const buildplaneEntity: BuildPlaneEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'BuildPlane',
      metadata: {
        name: buildplane.name,
        namespace: namespaceName,
        title: buildplane.displayName || buildplane.name,
        description: buildplane.description || `${buildplane.name} build plane`,
        tags: ['openchoreo', 'buildplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: buildplane.createdAt || '',
          [CHOREO_ANNOTATIONS.STATUS]: buildplane.status || '',
          'openchoreo.io/observability-plane-ref':
            this.normalizeObservabilityPlaneRef(
              buildplane.observabilityPlaneRef,
              namespaceName,
            ),
          ...this.mapAgentConnectionAnnotations(buildplane.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/buildplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
        domain: `default/${namespaceName}`,
        observabilityPlaneRef: this.normalizeObservabilityPlaneRef(
          buildplane.observabilityPlaneRef,
          namespaceName,
        ),
      },
    };

    return buildplaneEntity;
  }

  /**
   * Translates a ModelsObservabilityPlane from OpenChoreo API to a Backstage ObservabilityPlane entity
   */
  private translateObservabilityPlaneToEntity(
    obsplane: ModelsObservabilityPlane,
    namespaceName: string,
  ): ObservabilityPlaneEntityV1alpha1 {
    const obsplaneEntity: ObservabilityPlaneEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ObservabilityPlane',
      metadata: {
        name: obsplane.name,
        namespace: namespaceName,
        title: obsplane.displayName || obsplane.name,
        description:
          obsplane.description || `${obsplane.name} observability plane`,
        tags: ['openchoreo', 'observabilityplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: obsplane.createdAt || '',
          [CHOREO_ANNOTATIONS.STATUS]: obsplane.status || '',
          ...(obsplane.observerURL && {
            [CHOREO_ANNOTATIONS.OBSERVER_URL]: obsplane.observerURL,
          }),
          ...this.mapAgentConnectionAnnotations(obsplane.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/observabilityplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
        domain: `default/${namespaceName}`,
        observerURL: obsplane.observerURL,
      },
    };

    return obsplaneEntity;
  }

  /**
   * Normalizes an observabilityPlaneRef value to a namespace-qualified string.
   * The API may return this as a string or as an object { kind, name }.
   * The namespace is included so that processors resolve the ref to the correct
   * ObservabilityPlane entity (which lives in the same namespace as the parent).
   */
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

  /**
   * Maps agent connection status from the API response to Backstage entity annotations
   */
  private mapAgentConnectionAnnotations(
    agentConnection?: ModelsAgentConnectionStatus,
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

    if (agentConnection.lastHeartbeatTime) {
      annotations[CHOREO_ANNOTATIONS.AGENT_LAST_HEARTBEAT] =
        agentConnection.lastHeartbeatTime;
    }
    if (agentConnection.lastConnectedTime) {
      annotations[CHOREO_ANNOTATIONS.AGENT_LAST_CONNECTED] =
        agentConnection.lastConnectedTime;
    }
    if (agentConnection.lastDisconnectedTime) {
      annotations[CHOREO_ANNOTATIONS.AGENT_LAST_DISCONNECTED] =
        agentConnection.lastDisconnectedTime;
    }
    if (agentConnection.message) {
      annotations[CHOREO_ANNOTATIONS.AGENT_MESSAGE] = agentConnection.message;
    }

    return annotations;
  }

  /**
   * Translates a ModelsDeploymentPipeline from OpenChoreo API to a Backstage DeploymentPipeline entity
   */
  private translateDeploymentPipelineToEntity(
    pipeline: ModelsDeploymentPipeline,
    namespaceName: string,
    projectName: string,
  ): DeploymentPipelineEntityV1alpha1 {
    // Transform promotion paths from API format to entity format
    const promotionPaths =
      pipeline.promotionPaths?.map(path => ({
        sourceEnvironment: path.sourceEnvironmentRef,
        targetEnvironments:
          path.targetEnvironmentRefs?.map(target => ({
            name: target.name,
            requiresApproval: target.requiresApproval,
            isManualApprovalRequired: target.isManualApprovalRequired,
          })) || [],
      })) || [];

    const pipelineEntity: DeploymentPipelineEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'DeploymentPipeline',
      metadata: {
        name: pipeline.name,
        namespace: namespaceName,
        title: pipeline.displayName || pipeline.name,
        description:
          pipeline.description || `Deployment pipeline for ${projectName}`,
        tags: ['openchoreo', 'deployment-pipeline', 'platform-engineering'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.PROJECT]: projectName,
          ...(pipeline.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: pipeline.createdAt,
          }),
          ...(pipeline.status && {
            [CHOREO_ANNOTATIONS.STATUS]: pipeline.status,
          }),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/deployment-pipeline': 'true',
        },
      },
      spec: {
        type: 'promotion-pipeline',
        projectRefs: [projectName],
        namespaceName: namespaceName,
        promotionPaths,
      },
    };

    return pipelineEntity;
  }

  /**
   * Translates a ModelsComponent from OpenChoreo API to a Backstage Component entity.
   * Uses the shared translation utility to ensure consistency with other modules.
   */
  private translateComponentToEntity(
    component: ModelsComponent,
    namespaceName: string,
    projectName: string,
    providesApis?: string[],
  ): Entity {
    return translateComponent(
      component,
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
   * Translates a ModelsCompleteComponent (Service) to a Backstage Component entity with providesApis
   */
  private translateServiceComponentToEntity(
    completeComponent: ModelsCompleteComponent,
    namespaceName: string,
    projectName: string,
  ): Entity {
    // Generate API names for providesApis
    const providesApis: string[] = [];
    if (completeComponent.workload?.endpoints) {
      Object.keys(completeComponent.workload.endpoints).forEach(
        endpointName => {
          providesApis.push(`${completeComponent.name}-${endpointName}`);
        },
      );
    }

    // Reuse the base translateComponentToEntity method
    return this.translateComponentToEntity(
      completeComponent,
      namespaceName,
      projectName,
      providesApis,
    );
  }

  /**
   * Creates API entities from a Service component's workload endpoints
   */
  private createApiEntitiesFromWorkload(
    completeComponent: ModelsCompleteComponent,
    namespaceName: string,
    projectName: string,
  ): Entity[] {
    const apiEntities: Entity[] = [];

    if (!completeComponent.workload?.endpoints) {
      return apiEntities;
    }

    Object.entries(completeComponent.workload.endpoints).forEach(
      ([endpointName, endpoint]) => {
        const apiEntity: Entity = {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'API',
          metadata: {
            name: `${completeComponent.name}-${endpointName}`,
            namespace: namespaceName,
            title: `${completeComponent.name} ${endpointName} API`,
            description: `${endpoint.type} endpoint for ${completeComponent.name} service on port ${endpoint.port}`,
            tags: ['openchoreo', 'api', endpoint.type.toLowerCase()],
            annotations: {
              'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
              'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
              [CHOREO_ANNOTATIONS.COMPONENT]: completeComponent.name,
              [CHOREO_ANNOTATIONS.ENDPOINT_NAME]: endpointName,
              [CHOREO_ANNOTATIONS.ENDPOINT_TYPE]: endpoint.type,
              [CHOREO_ANNOTATIONS.ENDPOINT_PORT]: endpoint.port.toString(),
              [CHOREO_ANNOTATIONS.ENDPOINT_VISIBILITY]: endpoint.visibility,
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
      },
    );

    return apiEntities;
  }

  /**
   * Maps WorkloadEndpoint type to Backstage API spec type
   */
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

  /**
   * Creates API definition from WorkloadEndpoint
   */
  private createApiDefinitionFromWorkloadEndpoint(
    endpoint: WorkloadEndpoint,
  ): string {
    if (endpoint.schema?.content) {
      return endpoint.schema.content;
    }
    return 'No schema available';

    //   // Create a basic definition based on endpoint type
    //   if (endpoint.type === 'REST' || endpoint.type === 'HTTP') {
    //     const definition = {
    //       openapi: '3.0.0',
    //       info: {
    //         title: `${endpointName} API`,
    //         version: '1.0.0',
    //         description: `${endpoint.type} API endpoint on port ${endpoint.port}`,
    //       },
    //       servers: [
    //         {
    //           url: `http://localhost:${endpoint.port}`,
    //           description: `${endpoint.type} server`,
    //         },
    //       ],
    //       paths: {
    //         '/': {
    //           get: {
    //             summary: `${endpoint.type} endpoint`,
    //             description: `${endpoint.type} endpoint on port ${endpoint.port}`,
    //             responses: {
    //               '200': {
    //                 description: 'Successful response',
    //               },
    //             },
    //           },
    //         },
    //       },
    //     };
    //     return JSON.stringify(definition, null, 2);
    //   }

    //   if (endpoint.type === 'GraphQL') {
    //     const definition = {
    //       graphql: '1.0.0',
    //       info: {
    //         title: `${endpointName} GraphQL API`,
    //         version: '1.0.0',
    //         description: `GraphQL API endpoint on port ${endpoint.port}`,
    //       },
    //       servers: [
    //         {
    //           url: `http://localhost:${endpoint.port}/graphql`,
    //           description: 'GraphQL server',
    //         },
    //       ],
    //     };
    //     return JSON.stringify(definition, null, 2);
    //   }

    //   // Default minimal definition
    //   const definition = {
    //     info: {
    //       title: `${endpointName} API`,
    //       version: '1.0.0',
    //       description: `${endpoint.type} endpoint on port ${endpoint.port}`,
    //     },
    //     type: endpoint.type,
    //     port: endpoint.port,
    //   };
    //   return JSON.stringify(definition, null, 2);
  }

  /**
   * Translates a ComponentTypeResponse from OpenChoreo API to a Backstage ComponentType entity
   */
  private translateComponentTypeToEntity(
    ct: ModelsComponentType,
    namespaceName: string,
  ): ComponentTypeEntityV1alpha1 {
    return translateCT(ct, namespaceName, {
      locationKey: this.getProviderName(),
    });
  }

  /**
   * Translates a TraitResponse from OpenChoreo API to a Backstage TraitType entity
   */
  private translateTraitToEntity(
    trait: ModelsTrait,
    namespaceName: string,
  ): TraitTypeEntityV1alpha1 {
    return translateTrait(trait, namespaceName, {
      locationKey: this.getProviderName(),
    });
  }

  /**
   * Translates a WorkflowResponse from OpenChoreo API to a Backstage Workflow entity
   */
  private translateWorkflowToEntity(
    workflow: ModelsWorkflow,
    namespaceName: string,
  ): WorkflowEntityV1alpha1 {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflow.name,
        namespace: namespaceName,
        title: workflow.displayName || workflow.name,
        description: workflow.description || `${workflow.name} workflow`,
        tags: ['openchoreo', 'workflow', 'platform-engineering'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.CREATED_AT]: workflow.createdAt || '',
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
        },
      },
      spec: {
        type: 'workflow',
        domain: `default/${namespaceName}`,
      },
    };
  }

  /**
   * Translates a WorkflowResponse (component workflow) from OpenChoreo API to a Backstage ComponentWorkflow entity
   */
  private translateComponentWorkflowToEntity(
    cw: ModelsWorkflow | NewComponentWorkflowTemplate,
    namespaceName: string,
  ): ComponentWorkflowEntityV1alpha1 {
    return translateCW(cw, namespaceName, {
      locationKey: this.getProviderName(),
    });
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
          ? { name: env.spec.dataPlaneRef.name }
          : undefined,
        dnsPrefix: env.spec?.gateway?.publicVirtualHost,
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
          'openchoreo.io/public-virtual-host': gateway?.publicVirtualHost || '',
          'openchoreo.io/namespace-virtual-host':
            gateway?.organizationVirtualHost || '',
          'openchoreo.io/public-http-port':
            gateway?.publicHTTPPort?.toString() || '',
          'openchoreo.io/public-https-port':
            gateway?.publicHTTPSPort?.toString() || '',
          'openchoreo.io/namespace-http-port':
            gateway?.publicHTTPPort?.toString() || '',
          'openchoreo.io/namespace-https-port':
            gateway?.publicHTTPSPort?.toString() || '',
          'openchoreo.io/observability-plane-ref': normalizedObsRef,
          ...this.mapNewAgentConnectionAnnotations(dp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/dataplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
        domain: `default/${namespaceName}`,
        publicVirtualHost: gateway?.publicVirtualHost,
        namespaceVirtualHost: gateway?.organizationVirtualHost,
        publicHTTPPort: gateway?.publicHTTPPort,
        publicHTTPSPort: gateway?.publicHTTPSPort,
        namespaceHTTPPort: gateway?.publicHTTPPort,
        namespaceHTTPSPort: gateway?.publicHTTPSPort,
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
          'openchoreo.io/observability-plane-ref': normalizedObsRef,
          ...this.mapNewAgentConnectionAnnotations(bp.status?.agentConnection),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/buildplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
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
        type: 'kubernetes',
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
    return translateProject(
      {
        name: getName(project)!,
        displayName: getDisplayName(project),
        description: getDescription(project),
        namespaceName: getNamespace(project) ?? namespaceName,
        uid: getUid(project),
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
    const componentType =
      component.spec?.type ?? component.spec?.componentType ?? '';

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
              name: component.spec.workflow.name,
              systemParameters: {
                repository: {
                  url: component.spec.workflow.systemParameters.repository.url,
                  appPath:
                    component.spec.workflow.systemParameters.repository.appPath,
                  revision: {
                    branch:
                      component.spec.workflow.systemParameters.repository
                        .revision.branch,
                    commit:
                      component.spec.workflow.systemParameters.repository
                        .revision.commit,
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
        type: 'promotion-pipeline',
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
        allowedTraits: ct.spec?.allowedTraits?.map(t => ({ name: t })),
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
        type: 'workflow',
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
    return spec?.endpoints || {};
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
            [CHOREO_ANNOTATIONS.ENDPOINT_VISIBILITY]: endpoint.visibility,
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
}
