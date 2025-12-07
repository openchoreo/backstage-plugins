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
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
type ModelsOrganization =
  OpenChoreoComponents['schemas']['OrganizationResponse'];
type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
type ModelsDataPlane = OpenChoreoComponents['schemas']['DataPlaneResponse'];
type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];

// WorkloadEndpoint is part of the workload.endpoints structure
// Since Workload uses additionalProperties, we define this locally
interface WorkloadEndpoint {
  type: string;
  port: number;
  schema?: {
    content?: string;
  };
}
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  ComponentTypeUtils,
} from '@openchoreo/backstage-plugin-common';
import { EnvironmentEntityV1alpha1, DataplaneEntityV1alpha1 } from '../kinds';
import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
import { translateComponentToEntity as translateComponent } from '../utils/entityTranslation';

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

  constructor(
    taskRunner: SchedulerServiceTaskRunner,
    logger: LoggerService,
    config: Config,
  ) {
    this.taskRunner = taskRunner;
    this.logger = logger;
    this.baseUrl = config.getString('openchoreo.baseUrl');
    // Default owner for all entities - configurable via app-config.yaml
    this.defaultOwner =
      config.getOptionalString('openchoreo.defaultOwner') || 'developers';
    // Initialize CTD to Template converter
    this.ctdConverter = new CtdToTemplateConverter({
      defaultOwner: this.defaultOwner,
      namespace: 'openchoreo',
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

    try {
      this.logger.info(
        'Fetching organizations and projects from OpenChoreo API',
      );

      // Create client instance
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      // First, get all organizations
      const {
        data: orgData,
        error: orgError,
        response: orgResponse,
      } = await client.GET('/orgs');

      if (orgError || !orgResponse.ok) {
        throw new Error(
          `Failed to fetch organizations: ${orgResponse.status} ${orgResponse.statusText}`,
        );
      }

      if (!orgData.success || !orgData.data?.items) {
        throw new Error('Failed to retrieve organization list');
      }

      const organizations = orgData.data.items as ModelsOrganization[];
      this.logger.debug(
        `Found ${organizations.length} organizations from OpenChoreo`,
      );

      const allEntities: Entity[] = [];

      // Create Domain entities for each organization
      const domainEntities: Entity[] = organizations.map(org =>
        this.translateOrganizationToDomain(org),
      );
      allEntities.push(...domainEntities);

      // Get environments for each organization and create Environment entities
      for (const org of organizations) {
        try {
          const {
            data: envData,
            error: envError,
            response: envResponse,
          } = await client.GET('/orgs/{orgName}/environments', {
            params: {
              path: { orgName: org.name! },
            },
          });

          if (envError || !envResponse.ok) {
            this.logger.warn(
              `Failed to fetch environments for organization ${org.name}: ${envResponse.status}`,
            );
            continue;
          }

          const environments =
            envData.success && envData.data?.items
              ? (envData.data.items as ModelsEnvironment[])
              : [];
          this.logger.debug(
            `Found ${environments.length} environments in organization: ${org.name}`,
          );

          const environmentEntities: Entity[] = environments.map(environment =>
            this.translateEnvironmentToEntity(environment, org.name!),
          );
          allEntities.push(...environmentEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch environments for organization ${org.name}: ${error}`,
          );
        }
      }

      // Get dataplanes for each organization and create Dataplane entities
      for (const org of organizations) {
        try {
          const {
            data: dpData,
            error: dpError,
            response: dpResponse,
          } = await client.GET('/orgs/{orgName}/dataplanes', {
            params: {
              path: { orgName: org.name! },
            },
          });

          if (dpError || !dpResponse.ok) {
            this.logger.warn(
              `Failed to fetch dataplanes for organization ${org.name}: ${dpResponse.status}`,
            );
            continue;
          }

          const dataplanes =
            dpData.success && dpData.data?.items
              ? (dpData.data.items as ModelsDataPlane[])
              : [];
          this.logger.debug(
            `Found ${dataplanes.length} dataplanes in organization: ${org.name}`,
          );

          const dataplaneEntities: Entity[] = dataplanes.map(dataplane =>
            this.translateDataplaneToEntity(dataplane, org.name!),
          );
          allEntities.push(...dataplaneEntities);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch dataplanes for organization ${org.name}: ${error}`,
          );
        }
      }

      // Get projects for each organization and create System entities
      for (const org of organizations) {
        try {
          const {
            data: projData,
            error: projError,
            response: projResponse,
          } = await client.GET('/orgs/{orgName}/projects', {
            params: {
              path: { orgName: org.name! },
            },
          });

          if (projError || !projResponse.ok) {
            this.logger.warn(
              `Failed to fetch projects for organization ${org.name}: ${projResponse.status}`,
            );
            continue;
          }

          const projects =
            projData.success && projData.data?.items
              ? (projData.data.items as ModelsProject[])
              : [];
          this.logger.debug(
            `Found ${projects.length} projects in organization: ${org.name}`,
          );

          const systemEntities: Entity[] = projects.map(project =>
            this.translateProjectToEntity(project, org.name!),
          );
          allEntities.push(...systemEntities);

          // Get components for each project and create Component entities
          for (const project of projects) {
            try {
              const {
                data: compData,
                error: compError,
                response: compResponse,
              } = await client.GET(
                '/orgs/{orgName}/projects/{projectName}/components',
                {
                  params: {
                    path: { orgName: org.name!, projectName: project.name! },
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
                  ? compData.data.items
                  : [];
              this.logger.debug(
                `Found ${components.length} components in project: ${project.name}`,
              );

              for (const component of components) {
                // If the component is a Service, fetch complete details and create both component and API entities
                if (component.type === '') {
                  try {
                    const {
                      data: detailData,
                      error: detailError,
                      response: detailResponse,
                    } = await client.GET(
                      '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
                      {
                        params: {
                          path: {
                            orgName: org.name!,
                            projectName: project.name!,
                            componentName: component.name!,
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
                        org.name!,
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
                        org.name!,
                        project.name!,
                      );
                    allEntities.push(componentEntity);

                    // Create API entities if endpoints exist
                    if (completeComponent.workload?.endpoints) {
                      const apiEntities = this.createApiEntitiesFromWorkload(
                        completeComponent,
                        org.name!,
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
                      org.name!,
                      project.name!,
                    );
                    allEntities.push(componentEntity);
                  }
                } else {
                  // Create basic component entity for non-Service components
                  const componentEntity = this.translateComponentToEntity(
                    component,
                    org.name!,
                    project.name!,
                  );
                  allEntities.push(componentEntity);
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to fetch components for project ${project.name} in organization ${org.name}: ${error}`,
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch projects for organization ${org.name}: ${error}`,
          );
        }
      }

      // Fetch Component Type Definitions and generate Template entities
      // Use the new two-step API: list + schema for each CTD
      for (const org of organizations) {
        try {
          this.logger.info(
            `Fetching Component Type Definitions from OpenChoreo API for org: ${org.name}`,
          );

          // Step 1: List CTDs (complete metadata including allowedWorkflows)
          const {
            data: listData,
            error: listError,
            response: listResponse,
          } = await client.GET('/orgs/{orgName}/component-types', {
            params: {
              path: { orgName: org.name! },
            },
          });

          if (
            listError ||
            !listResponse.ok ||
            !listData.success ||
            !listData.data?.items
          ) {
            this.logger.warn(
              `Failed to fetch component types for org ${org.name}: ${listResponse.status}`,
            );
            continue;
          }

          const componentTypeItems = listData.data
            .items as OpenChoreoComponents['schemas']['ComponentTypeResponse'][];
          this.logger.debug(
            `Found ${componentTypeItems.length} CTDs in organization: ${org.name} (total: ${listData.data.totalCount})`,
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
                  '/orgs/{orgName}/component-types/{ctName}/schema',
                  {
                    params: {
                      path: { orgName: org.name!, ctName: listItem.name! },
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
                    `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${schemaResponse.status}`,
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
                    createdAt: listItem.createdAt!,
                  },
                  spec: {
                    inputParametersSchema: schemaData!.data as any,
                  },
                };

                return fullComponentType;
              } catch (error) {
                this.logger.warn(
                  `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${error}`,
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
                  this.ctdConverter.convertCtdToTemplateEntity(ctd, org.name!);
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
            `Successfully generated ${templateEntities.length} template entities from CTDs in org: ${org.name}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to fetch Component Type Definitions for org ${org.name}: ${error}`,
          );
        }
      }

      await this.connection.applyMutation({
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
      this.logger.info(
        `Successfully processed ${allEntities.length} entities (${domainEntities.length} domains, ${systemCount} systems, ${componentCount} components, ${apiCount} apis, ${environmentCount} environments)`,
      );
    } catch (error) {
      this.logger.error(`Failed to run OpenChoreoEntityProvider: ${error}`);
    }
  }

  /**
   * Translates a ModelsOrganization from OpenChoreo API to a Backstage Domain entity
   */
  private translateOrganizationToDomain(
    organization: ModelsOrganization,
  ): Entity {
    const domainEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Domain',
      metadata: {
        name: organization.name,
        title: organization.displayName || organization.name,
        description: organization.description || organization.name,
        // namespace: 'default',
        tags: ['openchoreo', 'organization', 'domain'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: organization.name,
          ...(organization.namespace && {
            [CHOREO_ANNOTATIONS.NAMESPACE]: organization.namespace,
          }),
          ...(organization.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: organization.createdAt,
          }),
          ...(organization.status && {
            [CHOREO_ANNOTATIONS.STATUS]: organization.status,
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
    orgName: string,
  ): Entity {
    const systemEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: project.name,
        title: project.displayName || project.name,
        description: project.description || project.name,
        // namespace: orgName,
        tags: ['openchoreo', 'project'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.PROJECT_ID]: project.name,
          ...(project.uid && {
            [CHOREO_ANNOTATIONS.PROJECT_UID]: project.uid,
          }),
          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
        },
        labels: {
          'openchoreo.io/managed': 'true',
          // ...project.metadata?.labels,
        },
      },
      spec: {
        owner: this.defaultOwner,
        domain: orgName,
      },
    };

    return systemEntity;
  }

  /**
   * Translates a ModelsEnvironment from OpenChoreo API to a Backstage Environment entity
   */
  private translateEnvironmentToEntity(
    environment: ModelsEnvironment,
    orgName: string,
  ): EnvironmentEntityV1alpha1 {
    const environmentEntity: EnvironmentEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Environment',
      metadata: {
        name: environment.name,
        title: environment.displayName || environment.name,
        description:
          environment.description || `${environment.name} environment`,
        tags: [
          'openchoreo',
          'environment',
          environment.isProduction ? 'production' : 'non-production',
        ],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.ENVIRONMENT]: environment.name,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
          ...(environment.namespace && {
            [CHOREO_ANNOTATIONS.NAMESPACE]: environment.namespace,
          }),
          ...(environment.createdAt && {
            [CHOREO_ANNOTATIONS.CREATED_AT]: environment.createdAt,
          }),
          ...(environment.status && {
            [CHOREO_ANNOTATIONS.STATUS]: environment.status,
          }),
          ...(environment.dataPlaneRef && {
            'openchoreo.io/data-plane-ref': environment.dataPlaneRef,
          }),
          ...(environment.dnsPrefix && {
            'openchoreo.io/dns-prefix': environment.dnsPrefix,
          }),
          ...(environment.isProduction !== undefined && {
            'openchoreo.io/is-production': environment.isProduction.toString(),
          }),
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          ...(environment.isProduction !== undefined && {
            'openchoreo.io/environment-type': environment.isProduction
              ? 'production'
              : 'non-production',
          }),
        },
      },
      spec: {
        type: environment.isProduction ? 'production' : 'non-production',
        owner: 'guests', // This could be configured or mapped from environment metadata
        domain: orgName, // Link to the parent domain (organization)
        isProduction: environment.isProduction,
        dataPlaneRef: environment.dataPlaneRef,
        dnsPrefix: environment.dnsPrefix,
      },
    };

    return environmentEntity;
  }

  /**
   * Translates a ModelsDataPlane from OpenChoreo API to a Backstage Dataplane entity
   */
  private translateDataplaneToEntity(
    dataplane: ModelsDataPlane,
    orgName: string,
  ): DataplaneEntityV1alpha1 {
    const dataplaneEntity: DataplaneEntityV1alpha1 = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Dataplane',
      metadata: {
        name: dataplane.name,
        title: dataplane.displayName || dataplane.name,
        description: dataplane.description || `${dataplane.name} dataplane`,
        tags: ['openchoreo', 'dataplane', 'infrastructure'],
        annotations: {
          'backstage.io/managed-by-location': `provider:${this.getProviderName()}`,
          'backstage.io/managed-by-origin-location': `provider:${this.getProviderName()}`,
          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
          [CHOREO_ANNOTATIONS.NAMESPACE]: dataplane.namespace || '',
          [CHOREO_ANNOTATIONS.CREATED_AT]: dataplane.createdAt || '',
          [CHOREO_ANNOTATIONS.STATUS]: dataplane.status || '',
          'openchoreo.io/kubernetes-cluster-name':
            dataplane.kubernetesClusterName || '',
          'openchoreo.io/api-server-url': dataplane.apiServerURL || '',
          'openchoreo.io/public-virtual-host':
            dataplane.publicVirtualHost || '',
          'openchoreo.io/organization-virtual-host':
            dataplane.organizationVirtualHost || '',
          'openchoreo.io/observer-url': dataplane.observerURL || '',
          'openchoreo.io/observer-username': dataplane.observerUsername || '',
        },
        labels: {
          [CHOREO_LABELS.MANAGED]: 'true',
          'openchoreo.io/dataplane': 'true',
        },
      },
      spec: {
        type: 'kubernetes',
        owner: 'guests', // This could be configured or mapped from dataplane metadata
        domain: orgName, // Link to the parent domain (organization)
        kubernetesClusterName: dataplane.kubernetesClusterName,
        apiServerURL: dataplane.apiServerURL,
        publicVirtualHost: dataplane.publicVirtualHost,
        organizationVirtualHost: dataplane.organizationVirtualHost,
        observerURL: dataplane.observerURL,
      },
    };

    return dataplaneEntity;
  }

  /**
   * Translates a ModelsComponent from OpenChoreo API to a Backstage Component entity.
   * Uses the shared translation utility to ensure consistency with other modules.
   */
  private translateComponentToEntity(
    component: ModelsComponent,
    orgName: string,
    projectName: string,
    providesApis?: string[],
  ): Entity {
    return translateComponent(
      component,
      orgName,
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
    orgName: string,
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
      orgName,
      projectName,
      providesApis,
    );
  }

  /**
   * Creates API entities from a Service component's workload endpoints
   */
  private createApiEntitiesFromWorkload(
    completeComponent: ModelsCompleteComponent,
    orgName: string,
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
              [CHOREO_ANNOTATIONS.PROJECT]: projectName,
              [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
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
}
