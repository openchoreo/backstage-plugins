import { LoggerService } from '@backstage/backend-plugin-api';
import { EnvironmentService, Environment, EndpointInfo } from '../../types';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  fetchAllPages,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import type {
  EnvironmentResponse,
  ReleaseBindingResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  transformEnvironment,
  transformDeploymentPipeline,
  transformReleaseBinding,
} from '../transformers';

type ModelsEnvironment = EnvironmentResponse;

type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

/**
 * Extracts the environment name from a sourceEnvironmentRef which may be
 * a plain string (old API) or an object { kind, name } (new API).
 */
function getSourceEnvName(ref: unknown): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && 'name' in ref) {
    return (ref as { name: string }).name;
  }
  return '';
}

/**
 * Service for managing and retrieving environment-related information for deployments.
 * This service handles fetching environment details from the OpenChoreo API.
 * All methods require a user token to be passed for authentication.
 */
export class EnvironmentInfoService implements EnvironmentService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  static create(
    logger: LoggerService,
    baseUrl: string,
  ): EnvironmentInfoService {
    return new EnvironmentInfoService(logger, baseUrl);
  }

  /**
   * Fetches deployment information for a specific component in a project.
   * This method retrieves detailed information about deployments across different environments
   * using the bindings API, including their status, deployment time, images, and endpoints.
   * Environments are returned in the order defined by the deployment pipeline.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.componentName - Name of the component to fetch deployment info for
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @returns {Promise<Environment[]>} Array of environments with their deployment information
   * @throws {Error} When there's an error fetching data from the API
   */
  async fetchDeploymentInfo(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for component: ${request.componentName}`,
      );

      const createTimedPromise = <T>(promise: Promise<T>, name: string) => {
        const start = Date.now();
        return promise
          .then(result => ({
            type: name,
            result,
            duration: Date.now() - start,
          }))
          .catch(error => {
            if (
              error.name === 'NotAllowedError' ||
              error.name === 'AuthenticationError'
            ) {
              throw error;
            }
            const duration = Date.now() - start;
            if (name === 'bindings') {
              this.logger.warn(
                `Failed to fetch bindings for component ${request.componentName}: ${error}`,
              );
              return { type: name, result: [] as any, duration };
            } else if (name === 'pipeline') {
              this.logger.warn(
                `No deployment pipeline found for project ${request.projectName}, using default ordering`,
              );
              return { type: name, result: null as any, duration };
            }
            throw error;
          });
      };

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch environments with cursor-based pagination
      const environmentsPromise = createTimedPromise(
        fetchAllPages(cursor =>
          client
            .GET('/api/v1/namespaces/{namespaceName}/environments', {
              params: {
                path: { namespaceName: request.namespaceName },
                query: { limit: 100, cursor },
              },
            })
            .then(res => {
              assertApiResponse(res, 'fetch environments');
              return res.data;
            }),
        ),
        'environments',
      );

      // Fetch release bindings filtered by component (not paginated)
      const bindingsPromise = createTimedPromise(
        (async () => {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/releasebindings',
            {
              params: {
                path: { namespaceName: request.namespaceName },
                query: { component: request.componentName },
              },
            },
          );
          assertApiResponse(
            { data, error, response },
            'fetch release bindings',
          );
          return data!.items || [];
        })(),
        'bindings',
      );

      // Fetch project-specific deployment pipeline
      const pipelinePromise = createTimedPromise(
        (async () => {
          // First, fetch the project to get its pipeline reference
          const {
            data: project,
            error: projectError,
            response: projectResponse,
          } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
            {
              params: {
                path: {
                  namespaceName: request.namespaceName,
                  projectName: request.projectName,
                },
              },
            },
          );
          if (
            projectError ||
            !projectResponse.ok ||
            !project?.spec?.deploymentPipelineRef?.name
          ) {
            return null;
          }

          // Then fetch the specific deployment pipeline by name
          const pipelineName = project.spec.deploymentPipelineRef.name;
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
            {
              params: {
                path: {
                  namespaceName: request.namespaceName,
                  deploymentPipelineName: pipelineName,
                },
              },
            },
          );
          if (error || !response.ok) {
            return null;
          }
          return transformDeploymentPipeline(data!);
        })(),
        'pipeline',
      );

      const fetchStart = Date.now();
      const [environmentsResult, bindingsResult, pipelineResult] =
        await Promise.all([
          environmentsPromise,
          bindingsPromise,
          pipelinePromise,
        ]);
      const fetchEnd = Date.now();

      this.logger.debug(
        `API call timings - Environments: ${environmentsResult.duration}ms, Bindings: ${bindingsResult.duration}ms, Pipeline: ${pipelineResult.duration}ms`,
      );
      this.logger.debug(
        `Total parallel API calls completed in ${fetchEnd - fetchStart}ms`,
      );

      const newEnvironments = environmentsResult.result;
      const newBindings = bindingsResult.result as NewReleaseBinding[];
      const deploymentPipeline = pipelineResult.result;

      if (!newEnvironments || newEnvironments.length === 0) {
        this.logger.warn('No environments found in API response');
        return [];
      }

      // Transform new K8s-style environments to legacy shape
      const environments = newEnvironments.map(transformEnvironment);

      // Transform new K8s-style bindings to legacy shape
      const bindings: ReleaseBindingResponse[] = newBindings.map(
        transformReleaseBinding,
      );

      // Transform environment data with bindings and promotion information
      const transformStart = Date.now();
      const result = this.transformEnvironmentDataWithBindings(
        environments,
        bindings,
        deploymentPipeline,
      );
      const transformEnd = Date.now();

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed for ${request.componentName}: ` +
          `Individual API calls (Env: ${environmentsResult.duration}ms, Bind: ${bindingsResult.duration}ms, Pipeline: ${pipelineResult.duration}ms), ` +
          `Parallel execution: ${fetchEnd - fetchStart}ms, ` +
          `Transform: ${transformEnd - transformStart}ms, ` +
          `Total: ${totalTime}ms`,
      );

      return result;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'NotAllowedError' ||
          error.name === 'AuthenticationError')
      ) {
        throw error;
      }
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching deployment info for ${request.projectName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  private transformEnvironmentDataWithBindings(
    environmentData: ModelsEnvironment[],
    bindings: ReleaseBindingResponse[],
    deploymentPipeline: any | null,
  ): Environment[] {
    // Create maps for easy lookup
    const envMap = new Map<string, ModelsEnvironment>();
    const envNameMap = new Map<string, string>(); // lowercase -> actual name
    const bindingsByEnv = new Map<string, ReleaseBindingResponse>();

    // Build environment maps
    for (const env of environmentData) {
      const displayName = env.displayName || env.name;
      envMap.set(displayName, env);
      envMap.set(displayName.toLowerCase(), env);
      envNameMap.set(displayName.toLowerCase(), displayName);
      // Also index by K8s resource name so pipeline refs resolve
      if (env.name && env.name.toLowerCase() !== displayName.toLowerCase()) {
        envMap.set(env.name, env);
        envMap.set(env.name.toLowerCase(), env);
        envNameMap.set(env.name.toLowerCase(), displayName);
      }
    }

    // Build bindings map by environment
    for (const binding of bindings) {
      const envName =
        envNameMap.get(binding.environment.toLowerCase()) ||
        binding.environment;
      bindingsByEnv.set(envName, binding);
    }

    // If no pipeline data, use default ordering
    if (
      !deploymentPipeline ||
      !deploymentPipeline.promotionPaths ||
      deploymentPipeline.promotionPaths.length === 0
    ) {
      this.logger.debug('No deployment pipeline found, using default ordering');
      return this.transformEnvironmentDataWithBindingsOnly(
        environmentData,
        bindingsByEnv,
      );
    }

    // Build promotion map from pipeline data (normalized to actual env names)
    const promotionMap = new Map<string, any[]>();
    for (const path of deploymentPipeline.promotionPaths) {
      const sourceRef = getSourceEnvName(path.sourceEnvironmentRef);
      const sourceEnv = envNameMap.get(sourceRef.toLowerCase()) || sourceRef;
      const targets = path.targetEnvironmentRefs.map((ref: any) => ({
        ...ref,
        name: envNameMap.get(ref.name.toLowerCase()) || ref.name,
        resourceName: ref.name,
      }));
      promotionMap.set(sourceEnv, targets);
    }

    // Determine environment order based on pipeline
    const orderedEnvNames = this.getEnvironmentOrder(
      deploymentPipeline.promotionPaths,
      envNameMap,
    );

    // Transform environments in pipeline order
    const orderedEnvironments: Environment[] = [];
    const processedEnvs = new Set<string>();

    for (const envName of orderedEnvNames) {
      const envData = envMap.get(envName);
      if (envData && !processedEnvs.has(envName)) {
        processedEnvs.add(envName);
        const binding = bindingsByEnv.get(envName);
        const promotionTargets = promotionMap.get(envName);

        const transformedEnv = this.createEnvironmentFromBinding(
          envData,
          binding,
          promotionTargets,
        );

        orderedEnvironments.push(transformedEnv);
      }
    }

    return orderedEnvironments;
  }

  private createEnvironmentFromBinding(
    envData: ModelsEnvironment,
    binding: ReleaseBindingResponse | undefined,
    promotionTargets?: any[],
  ): Environment {
    const envName = envData.displayName || envData.name;
    const envResourceName = envData.name; // Actual Kubernetes resource name

    // For now, ReleaseBinding doesn't provide detailed status, endpoints, or image info
    // Those would need to come from querying the actual deployed resources
    const endpoints: EndpointInfo[] = [];
    let image: string | undefined;
    let deploymentStatus: 'Ready' | 'NotReady' | 'Failed' | undefined;
    let lastDeployed: string | undefined;
    let releaseName: string | undefined;

    if (binding) {
      deploymentStatus = binding.status as
        | 'Ready'
        | 'NotReady'
        | 'Failed'
        | undefined;
      lastDeployed = binding.lastSpecUpdateTime ?? binding.createdAt;
      releaseName = binding.releaseName;

      if (binding.endpoints && binding.endpoints.length > 0) {
        endpoints.push(...binding.endpoints);
      }
    }

    const transformedEnv: Environment = {
      uid: envData.uid,
      name: envName,
      resourceName: envResourceName,
      bindingName: binding?.name,
      hasComponentTypeOverrides:
        binding?.componentTypeEnvironmentConfigs &&
        Object.keys(binding.componentTypeEnvironmentConfigs).length > 0,
      dataPlaneRef: envData.dataPlaneRef?.name,
      dataPlaneKind: envData.dataPlaneRef?.kind as
        | 'DataPlane'
        | 'ClusterDataPlane'
        | undefined,
      deployment: {
        status: deploymentStatus,
        statusReason: binding?.statusReason,
        statusMessage: binding?.statusMessage,
        lastDeployed,
        image,
        releaseName,
      },
      endpoints,
    };

    // Add promotion targets if they exist
    if (promotionTargets && promotionTargets.length > 0) {
      transformedEnv.promotionTargets = promotionTargets.map((ref: any) => ({
        name: ref.name,
        resourceName: ref.resourceName,
        requiresApproval: ref.requiresApproval,
        isManualApprovalRequired: ref.isManualApprovalRequired,
      }));
    }

    return transformedEnv;
  }

  private transformEnvironmentDataWithBindingsOnly(
    environmentData: ModelsEnvironment[],
    bindingsByEnv: Map<string, ReleaseBindingResponse>,
  ): Environment[] {
    return environmentData.map(env => {
      const envName = env.displayName || env.name;
      const binding = bindingsByEnv.get(envName);
      return this.createEnvironmentFromBinding(env, binding);
    });
  }

  private getEnvironmentOrder(
    promotionPaths: any[],
    envNameMap: Map<string, string>,
  ): string[] {
    // Build a proper dependency graph
    const graph = new Map<string, Set<string>>();
    const allEnvs = new Set<string>();

    // Initialize graph and collect all environments
    for (const path of promotionPaths) {
      const sourceRef = getSourceEnvName(path.sourceEnvironmentRef);
      const source = envNameMap.get(sourceRef.toLowerCase()) || sourceRef;
      allEnvs.add(source);

      if (!graph.has(source)) {
        graph.set(source, new Set());
      }

      for (const target of path.targetEnvironmentRefs) {
        const targetName =
          envNameMap.get(target.name.toLowerCase()) || target.name;
        allEnvs.add(targetName);
        graph.get(source)!.add(targetName);
      }
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const env of allEnvs) {
      inDegree.set(env, 0);
    }

    // Calculate in-degrees
    for (const [_, targets] of graph) {
      for (const target of targets) {
        inDegree.set(target, (inDegree.get(target) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [env, degree] of inDegree) {
      if (degree === 0) {
        queue.push(env);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = graph.get(current) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we have a specific order preference for environments with same level, apply it
    // This ensures Development -> Staging -> Production order when they're at the same level
    const preferredOrder = ['Development', 'Staging', 'Production'];

    // Group environments by their level in the DAG
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    const calculateLevel = (env: string, level: number = 0): number => {
      if (visited.has(env)) return levels.get(env) || 0;
      visited.add(env);
      levels.set(env, level);

      const neighbors = graph.get(env) || new Set();
      for (const neighbor of neighbors) {
        calculateLevel(neighbor, level + 1);
      }
      return level;
    };

    // Calculate levels for all environments
    for (const env of result) {
      if (!visited.has(env)) {
        calculateLevel(env);
      }
    }

    // Sort by level first, then by preferred order
    result.sort((a, b) => {
      const levelA = levels.get(a) || 0;
      const levelB = levels.get(b) || 0;

      if (levelA !== levelB) {
        return levelA - levelB;
      }

      // Same level, use preferred order
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return a.localeCompare(b);
    });

    return result;
  }

  /**
   * Promotes a component from source environment to target environment.
   * Uses the OpenChoreo API client to perform the promotion and returns updated environment data.
   *
   * @param {Object} request - The promotion request parameters
   * @param {string} request.sourceEnvironment - Source environment name
   * @param {string} request.targetEnvironment - Target environment name
   * @param {string} request.componentName - Name of the component to promote
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error promoting the component
   */
  async promoteComponent(
    request: {
      sourceEnvironment: string;
      targetEnvironment: string;
      componentName: string;
      projectName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Starting promotion for component: ${request.componentName} from ${request.sourceEnvironment} to ${request.targetEnvironment}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { error, response } = await (client as any).POST(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}/promote',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              componentName: request.componentName,
            },
          },
          body: {
            sourceEnv: request.sourceEnvironment,
            targetEnv: request.targetEnvironment,
          },
        },
      );

      assertApiResponse(
        { data: undefined, error, response },
        'promote component',
      );

      this.logger.debug(`Promotion completed successfully.`);

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo(
        {
          componentName: request.componentName,
          projectName: request.projectName,
          namespaceName: request.namespaceName,
        },
        token,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component promotion completed for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return refreshedEnvironments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error promoting component ${request.componentName} from ${request.sourceEnvironment} to ${request.targetEnvironment} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Deletes a ReleaseBinding from an environment (unpromote).
   * Uses the OpenChoreo API DELETE endpoint to remove the ReleaseBinding resource.
   *
   * @param {Object} request - The delete request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @param {string} request.environment - Environment to unpromote from
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error deleting the binding
   */
  async deleteReleaseBinding(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      environment: string;
    },
    token?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Deleting release binding for component: ${request.componentName} from environment: ${request.environment}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const bindingName = `${request.componentName}-${request.environment}`;

      const { error, response } = await client.DELETE(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: bindingName,
            },
          },
        },
      );

      assertApiResponse(
        { data: undefined, error, response },
        'delete release binding',
      );

      this.logger.debug(
        `Release binding deleted successfully for ${request.componentName} from ${request.environment}`,
      );

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo(
        {
          componentName: request.componentName,
          projectName: request.projectName,
          namespaceName: request.namespaceName,
        },
        token,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component unpromote completed for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return refreshedEnvironments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error deleting release binding for component ${request.componentName} from ${request.environment} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Updates a component binding's release state (Active, Suspend, or Undeploy).
   * Uses the OpenChoreo API client to update the binding and returns updated environment data.
   *
   * @param {Object} request - The update request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @param {string} request.bindingName - Name of the binding to update
   * @param {'Active' | 'Suspend' | 'Undeploy'} request.releaseState - The new release state
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error updating the binding
   */
  async updateComponentBinding(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      bindingName: string;
      releaseState: 'Active' | 'Suspend' | 'Undeploy';
    },
    token?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Starting binding update for component: ${request.componentName}, binding: ${request.bindingName}, new state: ${request.releaseState}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // New API uses PUT (full update): GET existing, modify state, PUT back
      const {
        data: existing,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: request.bindingName,
            },
          },
        },
      );

      assertApiResponse(
        { data: existing, error: getError, response: getResponse },
        'fetch binding for update',
      );

      // Map legacy releaseState to new API state field
      const stateMap: Record<string, 'Active' | 'Undeploy'> = {
        Active: 'Active',
        Suspend: 'Undeploy',
        Undeploy: 'Undeploy',
      };

      const updated = {
        ...existing!,
        spec: {
          ...existing!.spec!,
          state: stateMap[request.releaseState] ?? 'Active',
        },
      };

      const { error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: request.bindingName,
            },
          },
          body: updated,
        },
      );

      assertApiResponse({ data: undefined, error, response }, 'update binding');

      this.logger.debug(
        `Binding update completed successfully for ${request.bindingName}.`,
      );

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo(
        {
          componentName: request.componentName,
          projectName: request.projectName,
          namespaceName: request.namespaceName,
        },
        token,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component binding update completed for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return refreshedEnvironments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error updating binding ${request.bindingName} for component ${request.componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Creates a ComponentRelease with an optional release name.
   * If no release name is provided, the backend auto-generates one.
   *
   * @param {Object} request - The create release request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} [request.releaseName] - Optional release name (auto-generated if omitted)
   * @returns {Promise<any>} Response from the OpenChoreo API
   */
  async createComponentRelease(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      releaseName?: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Creating component release for ${request.componentName} in namespace: ${request.namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}/generate-release',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              componentName: request.componentName,
            },
          },
          body: {
            releaseName: request.releaseName,
          },
        },
      );

      assertApiResponse({ data, error, response }, 'create component release');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component release created for ${request.componentName}: Total: ${totalTime}ms`,
      );

      const releaseName = (data as any).metadata?.name;
      if (!releaseName) {
        return {
          success: false,
          error:
            'Component release was created but no release name was returned in the response',
        };
      }

      return {
        success: true,
        data: {
          name: releaseName,
        },
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error creating component release for ${request.componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Deploys a ComponentRelease to the lowest environment in the deployment pipeline.
   *
   * @param {Object} request - The deploy request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} request.releaseName - Name of the release to deploy
   * @returns {Promise<Environment[]>} Updated environment information
   */
  async deployRelease(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      releaseName: string;
    },
    token?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    this.logger.debug(
      `Deploying release ${request.releaseName} for component ${request.componentName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      this.logger.debug(
        `Deploy release request: namespace=${request.namespaceName}, component=${request.componentName}, release=${request.releaseName}`,
      );

      const { error, response } = await (client as any).POST(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}/deploy',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              componentName: request.componentName,
            },
          },
          body: {
            releaseName: request.releaseName,
          },
        },
      );

      assertApiResponse({ data: undefined, error, response }, 'deploy release');

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo(
        {
          componentName: request.componentName,
          projectName: request.projectName,
          namespaceName: request.namespaceName,
        },
        token,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Release deployment completed for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return refreshedEnvironments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error deploying release ${request.releaseName} for component ${request.componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches the JSON schema for environment overrides for a specific component release.
   * This schema defines what override fields are available based on the ComponentType.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} request.releaseName - Name of the release to get schema for
   * @returns {Promise<any>} JSON Schema for the release's override configuration
   */
  async fetchComponentReleaseSchema(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      releaseName: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching component release schema for ${request.releaseName}`,
    );

    try {
      // Backend doesn't have a dedicated component release schema endpoint
      // Use the component schema endpoint instead
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}/schema',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              componentName: request.componentName,
            },
          },
        },
      );

      assertApiResponse(
        { data, error, response },
        'fetch component release schema',
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component release schema fetched for ${request.releaseName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching component release schema for ${request.releaseName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches a specific component release by name.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} request.releaseName - Name of the component release
   * @returns {Promise<any>} Component release details including frozen workload spec
   */
  async fetchComponentRelease(
    request: {
      namespaceName: string;
      releaseName: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(`Fetching component release ${request.releaseName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/componentreleases/{componentReleaseName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              componentReleaseName: request.releaseName,
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch component release');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component release fetched for ${request.releaseName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching component release ${request.releaseName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches all release bindings for a specific component.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace
   * @returns {Promise<any>} List of release bindings
   */
  async fetchReleaseBindings(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching release bindings for component ${request.componentName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings',
        {
          params: {
            path: { namespaceName: request.namespaceName },
            query: { component: request.componentName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch release bindings');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Release bindings fetched for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching release bindings for ${request.componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Creates or updates a release binding for deploy/promote actions.
   * If the binding doesn't exist, creates it with POST.
   * If it exists, updates it with PUT (merging overrides + releaseName + setting state to Active).
   *
   * This replaces the two-step flow of patchReleaseBindingOverrides + deployRelease/promoteToEnvironment.
   */
  async updateReleaseBinding(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      environment: string;
      componentTypeEnvironmentConfigs?: any;
      traitEnvironmentConfigs?: any;
      workloadOverrides?: any;
      releaseName: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Updating release binding for component ${request.componentName} in environment ${request.environment}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const bindingName = `${request.componentName}-${request.environment}`;

      // Try to GET the existing binding
      const {
        data: existing,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: bindingName,
            },
          },
        },
      );

      if (getResponse.ok && existing) {
        // Binding exists — update it with PUT
        const updated = {
          ...existing,
          spec: {
            ...existing.spec!,
            releaseName: request.releaseName,
            state: 'Active' as const,
            ...(request.componentTypeEnvironmentConfigs !== undefined
              ? {
                  componentTypeEnvironmentConfigs:
                    request.componentTypeEnvironmentConfigs,
                }
              : {}),
            ...(request.traitEnvironmentConfigs !== undefined
              ? { traitEnvironmentConfigs: request.traitEnvironmentConfigs }
              : {}),
            ...(request.workloadOverrides !== undefined
              ? { workloadOverrides: request.workloadOverrides }
              : {}),
          },
        };

        const { data, error, response } = await client.PUT(
          '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
          {
            params: {
              path: {
                namespaceName: request.namespaceName,
                releaseBindingName: bindingName,
              },
            },
            body: updated,
          },
        );

        assertApiResponse({ data, error, response }, 'update release binding');

        const totalTime = Date.now() - startTime;
        this.logger.debug(
          `Release binding updated for ${request.componentName} in ${request.environment}: Total: ${totalTime}ms`,
        );

        return data;
      }

      // Non-404 error — surface it rather than falling through to create
      if (getResponse.status !== 404) {
        const errorDetail = getError ? JSON.stringify(getError) : '';
        throw new Error(
          `Failed to fetch release binding: ${getResponse.status} ${
            getResponse.statusText
          }${errorDetail ? ` ${errorDetail}` : ''}`,
        );
      }

      // Binding does not exist (404) — create it with POST
      const newBinding = {
        metadata: {
          name: bindingName,
          namespace: request.namespaceName,
        },
        spec: {
          owner: {
            projectName: request.projectName,
            componentName: request.componentName,
          },
          environment: request.environment,
          releaseName: request.releaseName,
          state: 'Active' as const,
          ...(request.componentTypeEnvironmentConfigs !== undefined
            ? {
                componentTypeEnvironmentConfigs:
                  request.componentTypeEnvironmentConfigs,
              }
            : {}),
          ...(request.traitEnvironmentConfigs !== undefined
            ? { traitEnvironmentConfigs: request.traitEnvironmentConfigs }
            : {}),
          ...(request.workloadOverrides !== undefined
            ? { workloadOverrides: request.workloadOverrides }
            : {}),
        },
      };

      const {
        data: createData,
        error: createError,
        response: createResponse,
      } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/releasebindings',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
            },
          },
          body: newBinding,
        },
      );

      // Handle 409 Conflict — binding was created concurrently, fetch it
      if (createResponse.status === 409) {
        this.logger.debug(
          `Release binding ${bindingName} already exists (409 conflict), fetching existing`,
        );
        const {
          data: conflictExisting,
          error: conflictGetError,
          response: conflictGetResponse,
        } = await client.GET(
          '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
          {
            params: {
              path: {
                namespaceName: request.namespaceName,
                releaseBindingName: bindingName,
              },
            },
          },
        );

        assertApiResponse(
          {
            data: conflictExisting,
            error: conflictGetError,
            response: conflictGetResponse,
          },
          'fetch release binding after 409 conflict',
        );

        return conflictExisting;
      }

      assertApiResponse(
        { data: createData, error: createError, response: createResponse },
        'create release binding',
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Release binding created for ${request.componentName} in ${request.environment}: Total: ${totalTime}ms`,
      );

      return createData;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error updating release binding for ${request.componentName} in ${request.environment} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Patches a release binding with component type environment overrides.
   * Creates the binding if it doesn't exist.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} request.environment - Environment to patch binding for
   * @param {any} request.componentTypeEnvironmentConfigs - Component type environment overrides to apply
   * @param {any} request.traitEnvironmentConfigs - Trait-specific overrides to apply
   * @param {any} request.workloadOverrides - Workload container overrides to apply
   * @returns {Promise<any>} Updated binding response
   */
  async patchReleaseBindingOverrides(
    request: {
      componentName: string;
      projectName: string;
      namespaceName: string;
      environment: string;
      componentTypeEnvironmentConfigs: any;
      traitEnvironmentConfigs?: any;
      workloadOverrides?: any;
      releaseName?: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Patching release binding overrides for component ${request.componentName} in environment ${request.environment}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const bindingName = `${request.componentName}-${request.environment}`;

      // New API uses PUT (full update): GET existing, merge overrides, PUT back
      const {
        data: existing,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: bindingName,
            },
          },
        },
      );

      assertApiResponse(
        { data: existing, error: getError, response: getResponse },
        'fetch binding for patch',
      );

      const updated = {
        ...existing!,
        spec: {
          ...existing!.spec!,
          componentTypeEnvironmentConfigs:
            request.componentTypeEnvironmentConfigs,
          traitEnvironmentConfigs: request.traitEnvironmentConfigs,
          workloadOverrides: request.workloadOverrides,
          ...(request.releaseName ? { releaseName: request.releaseName } : {}),
        },
      };

      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: bindingName,
            },
          },
          body: updated,
        },
      );

      assertApiResponse({ data, error, response }, 'patch release binding');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Release binding patched for ${request.componentName} in ${request.environment}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error patching release binding for ${request.componentName} in ${request.environment} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches the resource tree for a specific release binding.
   * Returns hierarchical resource data grouped by releases for tree visualization.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.namespaceName - Name of the namespace
   * @param {string} request.releaseBindingName - Name of the release binding
   * @returns {Promise<any>} Resource tree data with releases and nodes
   */
  async fetchResourceTree(
    request: {
      namespaceName: string;
      releaseBindingName: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching resource tree for release binding ${request.releaseBindingName} in namespace ${request.namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}/k8sresources/tree',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: request.releaseBindingName,
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch resource tree');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Resource tree fetched for release binding ${request.releaseBindingName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching resource tree for release binding ${request.releaseBindingName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchResourceEvents(
    request: {
      namespaceName: string;
      releaseBindingName: string;
      group: string;
      version: string;
      kind: string;
      name: string;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching resource events for ${request.kind}/${request.name} in release binding ${request.releaseBindingName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}/k8sresources/events',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: request.releaseBindingName,
            },
            query: {
              ...(request.group ? { group: request.group } : {}),
              version: request.version,
              kind: request.kind,
              name: request.name,
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch resource events');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Resource events fetched for ${request.kind}/${request.name} in release binding ${request.releaseBindingName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching resource events for ${request.kind}/${request.name} in release binding ${request.releaseBindingName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchPodLogs(
    request: {
      namespaceName: string;
      releaseBindingName: string;
      podName: string;
      sinceSeconds?: number;
    },
    token?: string,
  ) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching pod logs for ${request.podName} in release binding ${request.releaseBindingName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}/k8sresources/logs',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              releaseBindingName: request.releaseBindingName,
            },
            query: {
              podName: request.podName,
              sinceSeconds: request.sinceSeconds,
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch pod logs');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Pod logs fetched for ${request.podName} in release binding ${request.releaseBindingName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching pod logs for ${request.podName} in release binding ${request.releaseBindingName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}
