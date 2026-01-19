import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
type ModelsDataPlane = OpenChoreoComponents['schemas']['DataPlaneResponse'];
type ReleaseBindingResponse =
  OpenChoreoComponents['schemas']['ReleaseBindingResponse'];

import {
  PlatformEnvironmentService,
  Environment,
  DataPlane,
  DataPlaneWithEnvironments,
} from '../types';

/**
 * Service for managing platform-wide environment information.
 * This service provides a platform engineer's view of all environments across namespaces.
 */
export class PlatformEnvironmentInfoService
  implements PlatformEnvironmentService
{
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  static create(
    logger: LoggerService,
    baseUrl: string,
  ): PlatformEnvironmentInfoService {
    return new PlatformEnvironmentInfoService(logger, baseUrl);
  }

  /**
   * Fetches all environments across all namespaces.
   * This provides a platform-wide view for platform engineers.
   */
  async fetchAllEnvironments(userToken?: string): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('Starting platform-wide environment fetch');

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // For now, we'll fetch environments from a default namespace
      // In a real implementation, you might need to fetch from multiple namespaces
      // or have a platform-wide API endpoint
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/environments',
        {
          params: {
            path: { namespaceName: 'default' }, // This should be configurable or fetched from a platform API
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch platform environments: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data.success || !data.data?.items) {
        this.logger.warn('No environments found in platform API response');
        return [];
      }

      const environments = data.data.items;
      const result = this.transformEnvironmentData(environments, 'default');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Platform environment fetch completed: ${result.length} environments found (${totalTime}ms)`,
      );

      return result;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching platform environments (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches environments for a specific namespace.
   */
  async fetchEnvironmentsByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/environments',
        {
          params: {
            path: { namespaceName: namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch environments for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data.success || !data.data?.items) {
        this.logger.warn(
          `No environments found for namespace ${namespaceName}`,
        );
        return [];
      }

      const environments = data.data.items;
      const result = this.transformEnvironmentData(environments, namespaceName);

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed for ${namespaceName}: ${result.length} environments found (${totalTime}ms)`,
      );

      return result;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environments for namespace ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches all dataplanes across all namespaces.
   * This provides a platform-wide view for platform engineers.
   */
  async fetchAllDataplanes(userToken?: string): Promise<DataPlane[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('Starting platform-wide dataplane fetch');

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // For now, we'll fetch dataplanes from a default namespace
      // In a real implementation, you might need to fetch from multiple namespaces
      // or have a platform-wide API endpoint
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/dataplanes',
        {
          params: {
            path: { namespaceName: 'default' }, // This should be configurable or fetched from a platform API
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch platform dataplanes: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data.success || !data.data?.items) {
        this.logger.warn('No dataplanes found in platform API response');
        return [];
      }

      const dataplanes = data.data.items;
      const result = this.transformDataPlaneData(dataplanes, 'default');

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Platform dataplane fetch completed: ${result.length} dataplanes found (${totalTime}ms)`,
      );

      return result;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching platform dataplanes (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches dataplanes for a specific namespace.
   */
  async fetchDataplanesByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<DataPlane[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting dataplane fetch for namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/dataplanes',
        {
          params: {
            path: { namespaceName: namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch dataplanes for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data.success || !data.data?.items) {
        this.logger.warn(`No dataplanes found for namespace ${namespaceName}`);
        return [];
      }

      const dataplanes = data.data.items;
      const result = this.transformDataPlaneData(dataplanes, namespaceName);

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Dataplane fetch completed for ${namespaceName}: ${result.length} dataplanes found (${totalTime}ms)`,
      );

      return result;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching dataplanes for namespace ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches all dataplanes with their associated environments
   */
  async fetchDataplanesWithEnvironments(
    userToken?: string,
  ): Promise<DataPlaneWithEnvironments[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('Starting dataplanes with environments fetch');

      // Fetch both dataplanes and environments in parallel
      const [dataplanes, environments] = await Promise.all([
        this.fetchAllDataplanes(userToken),
        this.fetchAllEnvironments(userToken),
      ]);

      // Group environments by dataPlaneRef
      const environmentsByDataPlane = new Map<string, Environment[]>();
      environments.forEach(env => {
        const dataPlaneRef = env.dataPlaneRef;
        if (!environmentsByDataPlane.has(dataPlaneRef)) {
          environmentsByDataPlane.set(dataPlaneRef, []);
        }
        environmentsByDataPlane.get(dataPlaneRef)!.push(env);
      });

      // Create DataPlaneWithEnvironments objects
      const dataplanesWithEnvironments: DataPlaneWithEnvironments[] =
        dataplanes.map(dataplane => ({
          ...dataplane,
          environments: environmentsByDataPlane.get(dataplane.name) || [],
        }));

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Dataplanes with environments fetch completed: ${dataplanesWithEnvironments.length} dataplanes with ${environments.length} total environments (${totalTime}ms)`,
      );

      return dataplanesWithEnvironments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching dataplanes with environments (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches all dataplanes with their associated environments and component counts
   */
  async fetchDataplanesWithEnvironmentsAndComponentCounts(
    userToken?: string,
  ): Promise<DataPlaneWithEnvironments[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        'Starting dataplanes with environments and component counts fetch',
      );

      // First get dataplanes with environments
      const dataplanesWithEnvironments =
        await this.fetchDataplanesWithEnvironments(userToken);

      // For each environment, we need to count components
      // Note: This is a simplified approach. In a real implementation, you might want to:
      // 1. Get all components from the catalog API
      // 2. For each component, check its bindings to see which environments it's deployed to
      // 3. Count components per environment

      // For now, we'll add a placeholder count and log that this needs catalog integration
      const enrichedDataplanes = dataplanesWithEnvironments.map(dataplane => ({
        ...dataplane,
        environments: dataplane.environments.map(env => ({
          ...env,
          componentCount: 0, // Placeholder - will be populated by frontend using catalog API
        })),
      }));

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Dataplanes with environments and component counts fetch completed: ${enrichedDataplanes.length} dataplanes (${totalTime}ms)`,
      );

      return enrichedDataplanes;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching dataplanes with environments and component counts (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches component counts per environment using bindings API
   */
  async fetchComponentCountsPerEnvironment(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<Map<string, number>> {
    const startTime = Date.now();
    const componentCountsByEnvironment = new Map<string, number>();

    try {
      this.logger.debug(
        `Starting component counts fetch for ${components.length} components`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // Process components in parallel with some concurrency control
      const batchSize = 10; // Process 10 components at a time to avoid overwhelming the API

      for (let i = 0; i < components.length; i += batchSize) {
        const batch = components.slice(i, i + batchSize);

        const batchPromises = batch.map(async component => {
          try {
            // Get bindings for this component
            const { data, error, response } = await client.GET(
              '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/release-bindings',
              {
                params: {
                  path: {
                    namespaceName: component.namespaceName,
                    projectName: component.projectName,
                    componentName: component.componentName,
                  },
                },
              },
            );

            if (!error && response.ok && data.success && data.data?.items) {
              // Count environments where this component is deployed
              const bindings = data.data.items as ReleaseBindingResponse[];
              bindings.forEach(binding => {
                const envName = binding.environment;
                if (envName) {
                  const currentCount =
                    componentCountsByEnvironment.get(envName) || 0;
                  componentCountsByEnvironment.set(envName, currentCount + 1);
                }
              });
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch bindings for component ${component.namespaceName}/${component.projectName}/${component.componentName}:`,
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        });

        // Wait for this batch to complete before processing the next
        await Promise.all(batchPromises);
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Component counts fetch completed: Found deployments in ${componentCountsByEnvironment.size} environments (${totalTime}ms)`,
      );

      return componentCountsByEnvironment;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching component counts (${totalTime}ms):`,
        error as Error,
      );
      return componentCountsByEnvironment;
    }
  }

  /**
   * Fetches count of distinct components that have at least one binding (deployment)
   */
  async fetchDistinctDeployedComponentsCount(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<number> {
    const startTime = Date.now();
    const deployedComponents = new Set<string>();

    try {
      this.logger.debug(
        `Starting distinct deployed components count for ${components.length} components`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // Process components in parallel with some concurrency control
      const batchSize = 10; // Process 10 components at a time to avoid overwhelming the API

      for (let i = 0; i < components.length; i += batchSize) {
        const batch = components.slice(i, i + batchSize);

        const batchPromises = batch.map(async component => {
          try {
            // Get bindings for this component
            const { data, error, response } = await client.GET(
              '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/release-bindings',
              {
                params: {
                  path: {
                    namespaceName: component.namespaceName,
                    projectName: component.projectName,
                    componentName: component.componentName,
                  },
                },
              },
            );

            if (
              !error &&
              response.ok &&
              data.success &&
              data.data?.items &&
              data.data.items.length > 0
            ) {
              // If component has at least one binding, count it as deployed
              const componentKey = `${component.namespaceName}/${component.projectName}/${component.componentName}`;
              deployedComponents.add(componentKey);
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch bindings for component ${component.namespaceName}/${component.projectName}/${component.componentName}:`,
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        });

        // Wait for this batch to complete before processing the next
        await Promise.all(batchPromises);
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Distinct deployed components count completed: Found ${deployedComponents.size} deployed components (${totalTime}ms)`,
      );

      return deployedComponents.size;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching distinct deployed components count (${totalTime}ms):`,
        error as Error,
      );
      return 0;
    }
  }

  /**
   * Fetches count of healthy workloads across all components
   * A workload is considered healthy if its status.status === 'Active'
   */
  async fetchHealthyWorkloadCount(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    userToken?: string,
  ): Promise<number> {
    const startTime = Date.now();
    let healthyWorkloadCount = 0;

    try {
      this.logger.debug(
        `Starting healthy workload count for ${components.length} components`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // Process components in parallel with some concurrency control
      const batchSize = 10; // Process 10 components at a time to avoid overwhelming the API

      for (let i = 0; i < components.length; i += batchSize) {
        const batch = components.slice(i, i + batchSize);

        const batchPromises = batch.map(async component => {
          try {
            // Get bindings for this component
            const { data, error, response } = await client.GET(
              '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/release-bindings',
              {
                params: {
                  path: {
                    namespaceName: component.namespaceName,
                    projectName: component.projectName,
                    componentName: component.componentName,
                  },
                },
              },
            );

            if (!error && response.ok && data.success && data.data?.items) {
              // Count healthy workloads by checking if status.status === 'Active'
              const bindings = data.data.items as ReleaseBindingResponse[];
              const healthyCount = bindings.filter(
                binding => binding.status === 'Ready',
              ).length;
              return healthyCount;
            }
            return 0;
          } catch (error) {
            this.logger.warn(
              `Failed to fetch bindings for component ${component.namespaceName}/${component.projectName}/${component.componentName}:`,
              error instanceof Error ? error : new Error(String(error)),
            );
            return 0;
          }
        });

        // Wait for this batch to complete and sum up the counts
        const batchCounts = await Promise.all(batchPromises);
        healthyWorkloadCount += batchCounts.reduce(
          (sum, count) => sum + count,
          0,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Healthy workload count completed: Found ${healthyWorkloadCount} healthy workloads (${totalTime}ms)`,
      );

      return healthyWorkloadCount;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching healthy workload count (${totalTime}ms):`,
        error as Error,
      );
      return 0;
    }
  }

  private transformEnvironmentData(
    environmentData: ModelsEnvironment[],
    namespaceName: string,
  ): Environment[] {
    return environmentData.map(env => {
      const transformedEnv: Environment = {
        name: env.name,
        namespace: env.namespace || '',
        displayName: env.displayName || env.name,
        description: env.description || '',
        namespaceName: namespaceName,
        dataPlaneRef: env.dataPlaneRef || '',
        isProduction: env.isProduction ?? false,
        dnsPrefix: env.dnsPrefix || '',
        createdAt: env.createdAt || '',
        status: env.status || '',
      };

      return transformedEnv;
    });
  }

  private transformDataPlaneData(
    dataplaneData: ModelsDataPlane[],
    namespaceName: string,
  ): DataPlane[] {
    return dataplaneData.map(dp => {
      const transformedDataPlane: DataPlane = {
        name: dp.name,
        namespace: dp.namespace,
        displayName: dp.displayName,
        description: dp.description,
        namespaceName: namespaceName,
        imagePullSecretRefs: dp.imagePullSecretRefs,
        secretStoreRef: dp.secretStoreRef,
        publicVirtualHost: dp.publicVirtualHost,
        namespaceVirtualHost: dp.namespaceVirtualHost,
        publicHTTPPort: dp.publicHTTPPort,
        publicHTTPSPort: dp.publicHTTPSPort,
        namespaceHTTPPort: dp.namespaceHTTPPort,
        namespaceHTTPSPort: dp.namespaceHTTPSPort,
        observabilityPlaneRef: dp.observabilityPlaneRef,
        createdAt: dp.createdAt,
        status: dp.status,
      };

      return transformedDataPlane;
    });
  }
}
