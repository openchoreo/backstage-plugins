import { LoggerService } from '@backstage/backend-plugin-api';
import { EnvironmentService, Environment, EndpointInfo } from '../../types';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
type ReleaseBindingResponse =
  OpenChoreoComponents['schemas']['ReleaseBindingResponse'];

/**
 * Service for managing and retrieving environment-related information for deployments.
 * This service handles fetching environment details from the OpenChoreo API.
 */
export class EnvironmentInfoService implements EnvironmentService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly token?: string;

  public constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  static create(
    logger: LoggerService,
    baseUrl: string,
    token?: string,
  ): EnvironmentInfoService {
    return new EnvironmentInfoService(logger, baseUrl, token);
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
   * @param {string} request.organizationName - Name of the organization owning the project
   * @returns {Promise<Environment[]>} Array of environments with their deployment information
   * @throws {Error} When there's an error fetching data from the API
   */
  async fetchDeploymentInfo(request: {
    projectName: string;
    componentName: string;
    organizationName: string;
  }): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for component: ${request.componentName}`,
      );

      // Fetch environments, bindings and deployment pipeline in parallel with individual timing
      const createTimedPromise = <T>(promise: Promise<T>, name: string) => {
        const start = Date.now();
        return promise
          .then(result => ({
            type: name,
            result,
            duration: Date.now() - start,
          }))
          .catch(error => {
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
        token: this.token,
        logger: this.logger,
      });

      const environmentsPromise = createTimedPromise(
        (async () => {
          const { data, error, response } = await client.GET(
            '/orgs/{orgName}/environments',
            {
              params: { path: { orgName: request.organizationName } },
            },
          );
          if (error || !response.ok) {
            throw new Error(`Failed to fetch environments: ${response.status}`);
          }
          return { ok: response.ok, json: async () => data };
        })(),
        'environments',
      );

      const bindingsPromise = createTimedPromise(
        (async () => {
          const { data, error, response } = await client.GET(
            '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
            {
              params: {
                path: {
                  orgName: request.organizationName,
                  projectName: request.projectName,
                  componentName: request.componentName,
                },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch release bindings: ${response.status}`,
            );
          }
          return data.success && data.data?.items ? data.data.items : [];
        })(),
        'bindings',
      );

      const pipelinePromise = createTimedPromise(
        (async () => {
          const { data, error, response } = await client.GET(
            '/orgs/{orgName}/projects/{projectName}/deployment-pipeline',
            {
              params: {
                path: {
                  orgName: request.organizationName,
                  projectName: request.projectName,
                },
              },
            },
          );
          if (error || !response.ok) {
            return null;
          }
          return data.success && data.data ? data.data : null;
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

      // Log individual timings
      this.logger.debug(
        `API call timings - Environments: ${environmentsResult.duration}ms, Bindings: ${bindingsResult.duration}ms, Pipeline: ${pipelineResult.duration}ms`,
      );
      this.logger.debug(
        `Total parallel API calls completed in ${fetchEnd - fetchStart}ms`,
      );

      const environmentsResponse = environmentsResult.result;
      const bindings = bindingsResult.result;
      const deploymentPipeline = pipelineResult.result;

      if (!environmentsResponse.ok) {
        this.logger.error(
          `Failed to fetch environments for organization ${request.organizationName}`,
        );
        return [];
      }

      const environmentsData = await environmentsResponse.json();
      if (!environmentsData.success || !environmentsData.data?.items) {
        this.logger.warn('No environments found in API response');
        return [];
      }

      const environments = environmentsData.data.items as ModelsEnvironment[];

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
    }

    // Build bindings map by environment
    for (const binding of bindings) {
      const envName =
        envNameMap.get(binding.environment.toLowerCase()) ||
        binding.environment;
      bindingsByEnv.set(envName, binding);
    }

    // If no pipeline data, use default ordering
    if (!deploymentPipeline || !deploymentPipeline.promotionPaths) {
      this.logger.debug('No deployment pipeline found, using default ordering');
      return this.transformEnvironmentDataWithBindingsOnly(
        environmentData,
        bindingsByEnv,
      );
    }

    // Build promotion map from pipeline data (normalized to actual env names)
    const promotionMap = new Map<string, any[]>();
    for (const path of deploymentPipeline.promotionPaths) {
      const sourceEnv =
        envNameMap.get(path.sourceEnvironmentRef.toLowerCase()) ||
        path.sourceEnvironmentRef;
      const targets = path.targetEnvironmentRefs.map((ref: any) => ({
        ...ref,
        name: envNameMap.get(ref.name.toLowerCase()) || ref.name,
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

    // Add any environments not in the pipeline at the end
    for (const env of environmentData) {
      const envName = env.displayName || env.name;
      if (!processedEnvs.has(envName)) {
        const binding = bindingsByEnv.get(envName);
        orderedEnvironments.push(
          this.createEnvironmentFromBinding(env, binding),
        );
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
    let deploymentStatus:
      | 'success'
      | 'failed'
      | 'pending'
      | 'not-deployed'
      | 'suspended' = 'not-deployed';
    let statusMessage: string | undefined;
    let lastDeployed: string | undefined;
    let releaseName: string | undefined;

    if (binding) {
      // Map the ReleaseBinding status string to our deployment status
      // The status field is a simple string from the ReleaseBinding CRD status
      if (binding.status) {
        const status = binding.status.toLowerCase();
        if (status.includes('ready') || status.includes('active')) {
          deploymentStatus = 'success';
        } else if (status.includes('failed') || status.includes('error')) {
          deploymentStatus = 'failed';
        } else if (status.includes('suspend')) {
          deploymentStatus = 'suspended';
        } else if (status.includes('notready') || status.includes('pending')) {
          deploymentStatus = 'pending';
        } else {
          deploymentStatus = 'pending';
        }
      }

      statusMessage = binding.status;
      lastDeployed = binding.createdAt;
      releaseName = binding.releaseName;

      // TODO: Once the API is updated to return deployment details,
      // extract image and endpoints information here
    }

    const transformedEnv: Environment = {
      uid: envData.uid,
      name: envName,
      resourceName: envResourceName,
      bindingName: binding?.name,
      hasComponentTypeOverrides:
        binding?.componentTypeEnvOverrides &&
        Object.keys(binding.componentTypeEnvOverrides).length > 0,
      deployment: {
        status: deploymentStatus,
        lastDeployed,
        image,
        statusMessage,
        releaseName,
      },
      endpoints,
    };

    // Add promotion targets if they exist
    if (promotionTargets && promotionTargets.length > 0) {
      transformedEnv.promotionTargets = promotionTargets.map((ref: any) => ({
        name: ref.name,
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
      const source =
        envNameMap.get(path.sourceEnvironmentRef.toLowerCase()) ||
        path.sourceEnvironmentRef;
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
   * @param {string} request.organizationName - Name of the organization owning the project
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error promoting the component
   */
  async promoteComponent(request: {
    sourceEnvironment: string;
    targetEnvironment: string;
    componentName: string;
    projectName: string;
    organizationName: string;
  }): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Starting promotion for component: ${request.componentName} from ${request.sourceEnvironment} to ${request.targetEnvironment}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      // Call the promotion API
      const { data, error, response } = await client.POST(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/promote',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
            },
          },
          body: {
            sourceEnv: request.sourceEnvironment,
            targetEnv: request.targetEnvironment,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(`Failed to promote component: ${response.status}`);
      }

      const promotionResult =
        data.success && data.data?.items ? data.data.items : [];

      this.logger.debug(
        `Promotion completed successfully. Received ${promotionResult.length} binding responses.`,
      );

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo({
        componentName: request.componentName,
        projectName: request.projectName,
        organizationName: request.organizationName,
      });

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
   * @param {string} request.organizationName - Name of the organization owning the project
   * @param {string} request.environment - Environment to unpromote from
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error deleting the binding
   */
  async deleteReleaseBinding(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    environment: string;
  }): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Deleting release binding for component: ${request.componentName} from environment: ${request.environment}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      // Construct the ReleaseBinding name (format: componentName-environment)
      const bindingName = `${request.componentName}-${request.environment}`;

      // Call the DELETE endpoint with ReleaseBinding resource definition
      const { error, response } = await client.DELETE('/delete', {
        body: {
          apiVersion: 'openchoreo.dev/v1alpha1',
          kind: 'ReleaseBinding',
          metadata: {
            name: bindingName,
            namespace: request.organizationName,
          },
        },
      });

      if (error || !response.ok) {
        throw new Error(`Failed to delete release binding: ${response.status}`);
      }

      this.logger.debug(
        `Release binding deleted successfully for ${request.componentName} from ${request.environment}`,
      );

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo({
        componentName: request.componentName,
        projectName: request.projectName,
        organizationName: request.organizationName,
      });

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
   * @param {string} request.organizationName - Name of the organization owning the project
   * @param {string} request.bindingName - Name of the binding to update
   * @param {'Active' | 'Suspend' | 'Undeploy'} request.releaseState - The new release state
   * @returns {Promise<Environment[]>} Array of environments with updated deployment information
   * @throws {Error} When there's an error updating the binding
   */
  async updateComponentBinding(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    bindingName: string;
    releaseState: 'Active' | 'Suspend' | 'Undeploy';
  }): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Starting binding update for component: ${request.componentName}, binding: ${request.bindingName}, new state: ${request.releaseState}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      // Call the update binding API
      const { error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/bindings/{bindingName}',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
              bindingName: request.bindingName,
            },
          },
          body: {
            releaseState: request.releaseState,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(`Failed to update binding: ${response.status}`);
      }

      this.logger.debug(
        `Binding update completed successfully for ${request.bindingName}.`,
      );

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo({
        componentName: request.componentName,
        projectName: request.projectName,
        organizationName: request.organizationName,
      });

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
   * @param {string} request.organizationName - Name of the organization
   * @param {string} [request.releaseName] - Optional release name (auto-generated if omitted)
   * @returns {Promise<any>} Response from the OpenChoreo API
   */
  async createComponentRelease(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    releaseName?: string;
  }) {
    const startTime = Date.now();
    this.logger.debug(
      `Creating component release for ${request.componentName} in ${request.projectName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const requestBody: any = {};
      if (request.releaseName) {
        requestBody.releaseName = request.releaseName;
      }

      const { data, error, response } = await client.POST(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/component-releases',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
            },
          },
          body: requestBody,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create component release: ${response.status} ${response.statusText}`,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component release created for ${request.componentName}: Total: ${totalTime}ms`,
      );

      return data;
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
   * @param {string} request.organizationName - Name of the organization
   * @param {string} request.releaseName - Name of the release to deploy
   * @returns {Promise<Environment[]>} Updated environment information
   */
  async deployRelease(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    releaseName: string;
  }): Promise<Environment[]> {
    const startTime = Date.now();
    this.logger.debug(
      `Deploying release ${request.releaseName} for component ${request.componentName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { error, response } = await client.POST(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/deploy',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
            },
          },
          body: {
            releaseName: request.releaseName,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to deploy release: ${response.status} ${response.statusText}`,
        );
      }

      // Fetch fresh environment data to return updated information
      const refreshedEnvironments = await this.fetchDeploymentInfo({
        componentName: request.componentName,
        projectName: request.projectName,
        organizationName: request.organizationName,
      });

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
   * @param {string} request.organizationName - Name of the organization
   * @param {string} request.releaseName - Name of the release to get schema for
   * @returns {Promise<any>} JSON Schema for the release's override configuration
   */
  async fetchComponentReleaseSchema(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    releaseName: string;
  }) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching component release schema for ${request.releaseName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/component-releases/{releaseName}/schema',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
              releaseName: request.releaseName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component release schema: ${response.status} ${response.statusText}`,
        );
      }

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
   * Fetches all release bindings for a specific component.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.organizationName - Name of the organization
   * @returns {Promise<any>} List of release bindings
   */
  async fetchReleaseBindings(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
  }) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching release bindings for component ${request.componentName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch release bindings: ${response.status} ${response.statusText}`,
        );
      }

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
   * Patches a release binding with component type environment overrides.
   * Creates the binding if it doesn't exist.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.organizationName - Name of the organization
   * @param {string} request.environment - Environment to patch binding for
   * @param {any} request.componentTypeEnvOverrides - Component type environment overrides to apply
   * @returns {Promise<any>} Updated binding response
   */
  async patchReleaseBindingOverrides(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    environment: string;
    componentTypeEnvOverrides: any;
  }) {
    const startTime = Date.now();
    this.logger.debug(
      `Patching release binding overrides for component ${request.componentName} in environment ${request.environment}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      // Construct the binding name: componentName-environment
      const bindingName = `${request.componentName}-${request.environment}`;

      const { data, error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings/{bindingName}',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
              bindingName: bindingName,
            },
          },
          body: {
            componentTypeEnvOverrides: request.componentTypeEnvOverrides,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to patch release binding: ${response.status} ${response.statusText}`,
        );
      }

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
   * Fetches the release information for a specific environment.
   * Returns the complete Release CRD with spec and status information.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentName - Name of the component
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.organizationName - Name of the organization
   * @param {string} request.environmentName - Name of the environment
   * @returns {Promise<any>} Release information including spec and status
   */
  async fetchEnvironmentRelease(request: {
    componentName: string;
    projectName: string;
    organizationName: string;
    environmentName: string;
  }) {
    const startTime = Date.now();
    this.logger.debug(
      `Fetching environment release for component ${request.componentName} in environment ${request.environmentName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/release',
        {
          params: {
            path: {
              orgName: request.organizationName,
              projectName: request.projectName,
              componentName: request.componentName,
              environmentName: request.environmentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch environment release: ${response.status} ${response.statusText}`,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment release fetched for ${request.componentName} in ${request.environmentName}: Total: ${totalTime}ms`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environment release for ${request.componentName} in ${request.environmentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}
