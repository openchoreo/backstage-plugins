import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

import {
  Project,
  Component,
  Connection as CellDiagramConnection,
} from '@wso2/cell-diagram';
import { CellDiagramService } from '../../types';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  fetchAllPages,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';

// Use generated type from OpenAPI spec
type ModelsCompleteComponent =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];
type WorkloadConnection = OpenChoreoLegacyComponents['schemas']['Connection'];
type WorkloadEndpoint =
  OpenChoreoLegacyComponents['schemas']['WorkloadEndpoint'];

enum ComponentType {
  SERVICE = 'service',
  WEB_APP = 'web-app',
  SCHEDULED_TASK = 'scheduled-task',
  MANUAL_TASK = 'manual-task',
  API_PROXY = 'api-proxy',
  WEB_HOOK = 'web-hook',
  EVENT_HANDLER = 'event-handler',
  TEST = 'test',
  EXTERNAL_CONSUMER = 'external-consumer',
  SYSTEM_COMPONENT = 'system',
}

enum ConnectionType {
  HTTP = 'http',
  GRPC = 'grpc',
  WebSocket = 'web-socket',
  Connector = 'connector',
  Datastore = 'datastore',
}

/**
 * Service implementation for fetching and managing Cell Diagram information.
 * @implements {CellDiagramService}
 */
export class CellDiagramInfoService implements CellDiagramService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly componentTypeUtils: ComponentTypeUtils;
  private readonly useNewApi: boolean;

  public constructor(
    logger: LoggerService,
    baseUrl: string,
    config: Config,
    useNewApi = false,
  ) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.componentTypeUtils = ComponentTypeUtils.fromConfig(config);
    this.useNewApi = useNewApi;
  }

  async fetchProjectInfo(
    {
      projectName,
      namespaceName,
    }: {
      projectName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<Project | undefined> {
    if (this.useNewApi) {
      return this.fetchProjectInfoNew({ projectName, namespaceName }, token);
    }
    return this.fetchProjectInfoLegacy({ projectName, namespaceName }, token);
  }

  private async fetchProjectInfoLegacy(
    {
      projectName,
      namespaceName,
    }: {
      projectName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<Project | undefined> {
    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const {
        data: componentsListData,
        error: listError,
        response: listResponse,
      } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components',
        {
          params: {
            path: { namespaceName, projectName },
          },
        },
      );

      if (listError || !listResponse.ok) {
        this.logger.error(
          `Failed to fetch components for project ${projectName}`,
        );
        return undefined;
      }

      if (!componentsListData.success || !componentsListData.data?.items) {
        this.logger.warn('No components found in API response');
        return undefined;
      }

      const completeComponents: ModelsCompleteComponent[] = [];

      for (const component of componentsListData.data.items) {
        const componentName = (component as { name?: string }).name;
        if (!componentName) continue;

        try {
          const {
            data: componentData,
            error: componentError,
            response: componentResponse,
          } = await client.GET(
            '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}',
            {
              params: {
                path: {
                  namespaceName,
                  projectName,
                  componentName,
                },
                query: {
                  include: 'type,workload',
                },
              },
            },
          );

          if (!componentError && componentResponse.ok) {
            if (componentData.success && componentData.data) {
              completeComponents.push(componentData.data);
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch component ${component.name}: ${error}`,
          );
        }
      }

      return this.buildProject(projectName, namespaceName, completeComponents);
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching project info for ${projectName}: ${error}`,
      );
      return undefined;
    }
  }

  private async fetchProjectInfoNew(
    {
      projectName,
      namespaceName,
    }: {
      projectName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<Project | undefined> {
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch components and workloads in parallel (2 calls instead of N+1)
      const [componentItems, workloadItems] = await Promise.all([
        fetchAllPages(cursor =>
          client
            .GET('/api/v1/namespaces/{namespaceName}/components', {
              params: {
                path: { namespaceName },
                query: { project: projectName, limit: 100, cursor },
              },
            })
            .then(res => {
              if (res.error || !res.response.ok) {
                throw new Error(
                  `Failed to fetch components: ${res.response.status} ${res.response.statusText}`,
                );
              }
              return res.data;
            }),
        ),
        fetchAllPages(cursor =>
          client
            .GET('/api/v1/namespaces/{namespaceName}/workloads', {
              params: {
                path: { namespaceName },
                query: { project: projectName, limit: 100, cursor },
              },
            })
            .then(res => {
              if (res.error || !res.response.ok) {
                throw new Error(
                  `Failed to fetch workloads: ${res.response.status} ${res.response.statusText}`,
                );
              }
              return res.data;
            }),
        ),
      ]);

      if (!componentItems.length) {
        this.logger.warn('No components found in API response');
        return undefined;
      }

      // Build a map from component name to workload spec
      const workloadMap = new Map<string, Record<string, unknown>>();
      for (const workload of workloadItems) {
        const wlName = workload.metadata?.name;
        if (wlName && workload.spec) {
          workloadMap.set(wlName, workload.spec);
        }
      }

      // Convert new API components to the legacy ModelsCompleteComponent shape
      // so we can reuse the existing buildProject logic
      const completeComponents: ModelsCompleteComponent[] = componentItems
        .map(comp => {
          const name = comp.metadata?.name ?? '';
          const componentType =
            comp.spec?.type ?? comp.spec?.componentType ?? '';
          const workloadSpec = workloadMap.get(name);

          return {
            name,
            type: componentType,
            workload: workloadSpec as ModelsCompleteComponent['workload'],
          } as ModelsCompleteComponent;
        })
        .filter(comp => comp.name);

      return this.buildProject(projectName, namespaceName, completeComponents);
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching project info for ${projectName}: ${error}`,
      );
      return undefined;
    }
  }

  private buildProject(
    projectName: string,
    namespaceName: string,
    completeComponents: ModelsCompleteComponent[],
  ): Project {
    const components: Component[] = completeComponents
      .filter(component => {
        if (!component.type) return false;
        // Exclude one-off jobs from the cell diagram
        return !component.type.startsWith('job/');
      })
      .map(component => {
        // Get connections from workload data included in component response
        const connections = this.generateConnections(
          component.workload?.connections as
            | { [key: string]: WorkloadConnection }
            | undefined,
          namespaceName,
          projectName,
          completeComponents,
        );

        // cronjob/* components render as scheduled tasks
        if (component.type!.startsWith('cronjob/')) {
          return {
            id: component.name || '',
            label: component.name || '',
            version: '1.0.0',
            type: ComponentType.SCHEDULED_TASK,
            services: {
              main: {
                id: component.name || '',
                label: component.name || '',
                type: 'ScheduledTask',
                dependencyIds: [],
              },
            },
            connections: connections,
          } as Component;
        }

        // proxy/* components render as API proxies
        if (component.type!.startsWith('proxy/')) {
          return {
            id: component.name || '',
            label: component.name || '',
            version: '1.0.0',
            type: ComponentType.API_PROXY,
            services: {
              main: {
                id: component.name || '',
                label: component.name || '',
                type: 'ApiProxy',
                dependencyIds: [],
              },
            },
            connections: connections,
          } as Component;
        }

        // deployment/* and statefulset/*:
        // build service entries from workload endpoints
        const endpoints = (component.workload?.endpoints || {}) as {
          [key: string]: WorkloadEndpoint;
        };
        const services: { [key: string]: any } = {};
        let hasHttpEndpoint = false;

        if (Object.keys(endpoints).length > 0) {
          Object.entries(endpoints).forEach(([endpointName, endpoint]) => {
            const visibility = endpoint.visibility ?? [];
            if (endpoint.type === 'HTTP') {
              hasHttpEndpoint = true;
            }
            services[endpointName] = {
              id: component.name || '',
              label: component.name || '',
              type: endpoint.type || 'SERVICE',
              dependencyIds: [],
              deploymentMetadata: {
                gateways: {
                  internet: {
                    isExposed: visibility.includes('external'),
                  },
                  intranet: {
                    isExposed:
                      visibility.includes('external') ||
                      visibility.includes('internal') ||
                      visibility.includes('namespace'),
                  },
                },
              },
            };
          });
        } else {
          // Fallback: create a default service entry so the component renders
          services.main = {
            id: component.name || '',
            label: component.name || '',
            type: 'SERVICE',
            dependencyIds: [],
            deploymentMetadata: {
              gateways: {
                internet: { isExposed: false },
                intranet: { isExposed: false },
              },
            },
          };
        }

        const pageVariant = this.componentTypeUtils.getPageVariant(
          component.type!,
        );
        const isWebApp = pageVariant === 'website' || hasHttpEndpoint;

        return {
          id: component.name || '',
          label: component.name || '',
          version: '1.0.0',
          type: isWebApp ? ComponentType.WEB_APP : ComponentType.SERVICE,
          services: services,
          connections: connections,
        } as Component;
      })
      .filter((component): component is Component => component !== null);

    return {
      id: projectName,
      name: projectName,
      modelVersion: '1.0.0',
      components: components,
      connections: [],
      configurations: [],
    };
  }

  private generateConnections(
    connections: { [key: string]: WorkloadConnection } | undefined,
    namespaceName: string,
    projectName: string,
    completeComponents: ModelsCompleteComponent[],
  ): CellDiagramConnection[] {
    if (!connections) {
      return [];
    }

    const conns: CellDiagramConnection[] = [];
    Object.entries(connections).forEach(
      ([connectionName, connection]: [string, WorkloadConnection]) => {
        const dependentComponentName = connection.params.componentName;
        const dependentProjectName = connection.params.projectName;

        // Check if dependent component is within the same project
        const isInternal = dependentProjectName === projectName;
        const dependentComponent = completeComponents.find(
          comp => comp.name === dependentComponentName,
        );

        const connectionId =
          isInternal && dependentComponent
            ? `${namespaceName}:${projectName}:${dependentComponent.name}:${connection.params.endpoint}`
            : `${namespaceName}:${dependentProjectName}:${dependentComponentName}:${connection.params.endpoint}`;

        conns.push({
          id: connectionId,
          label: connectionName,
          type: ConnectionType.HTTP, // TODO Infer based on api response
          onPlatform: isInternal,
          tooltip: `Connection to ${dependentComponentName} in ${dependentProjectName}`,
        });
      },
    );

    return conns;
  }
}
