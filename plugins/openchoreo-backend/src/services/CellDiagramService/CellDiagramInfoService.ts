import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

import {
  Project,
  Component,
  Connection as CellDiagramConnection,
} from '@wso2/cell-diagram';
import { CellDiagramService } from '../../types';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';

// Use generated type from OpenAPI spec
type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];
type WorkloadConnection = OpenChoreoComponents['schemas']['Connection'];
type WorkloadEndpoint = OpenChoreoComponents['schemas']['WorkloadEndpoint'];

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

  /**
   * Private constructor for CellDiagramInfoService.
   * Use the static create method to instantiate.
   * @param {LoggerService} logger - Logger service instance
   * @param {string} baseUrl - Base url of openchoreo api
   * @param {Config} config - Backstage config for component type mappings
   * @private
   */
  public constructor(logger: LoggerService, baseUrl: string, config: Config) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.componentTypeUtils = ComponentTypeUtils.fromConfig(config);
  }

  /**
   * Fetches project information including its components and their configurations.
   * @param {Object} request - The request object
   * @param {string} request.projectName - Name of the project to fetch
   * @param {string} request.namespaceName - Name of the namespace the project belongs to
   * @returns {Promise<Project | undefined>} Project information if found, undefined otherwise
   */
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
    try {
      const client = createOpenChoreoApiClient({
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
              const visibility = endpoint.visibility || 'project';
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
                      isExposed: visibility === 'external',
                    },
                    intranet: {
                      isExposed:
                        visibility === 'external' ||
                        visibility === 'internal' ||
                        visibility === 'namespace',
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

      const project: Project = {
        id: projectName,
        name: projectName,
        modelVersion: '1.0.0',
        components: components,
        connections: [],
        configurations: [],
      };

      return project;
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching project info for ${projectName}: ${error}`,
      );
      return undefined;
    }
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
