import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
  getName,
  getNamespace,
  getDisplayName,
  getDescription,
  getCreatedAt,
  isReady,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

import {
  PlatformEnvironmentService,
  Environment,
  DataPlane,
  DataPlaneWithEnvironments,
} from '../types';

type NewEnvironment = OpenChoreoComponents['schemas']['Environment'];
type NewDataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

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

      const namespaces = await this.fetchNamespaceNames(userToken);
      const results = await Promise.all(
        namespaces.map(ns => this.fetchEnvironmentsByNamespace(ns, userToken)),
      );

      const allEnvironments = results.flat();
      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Platform environment fetch completed: ${allEnvironments.length} environments across ${namespaces.length} namespaces (${totalTime}ms)`,
      );

      return allEnvironments;
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
        '/api/v1/namespaces/{namespaceName}/environments',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch environments for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data?.items) {
        this.logger.warn(
          `No environments found for namespace ${namespaceName}`,
        );
        return [];
      }

      const result = this.transformEnvironmentData(data.items, namespaceName);

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

      const namespaces = await this.fetchNamespaceNames(userToken);
      const results = await Promise.all(
        namespaces.map(ns => this.fetchDataplanesByNamespace(ns, userToken)),
      );

      const allDataplanes = results.flat();
      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Platform dataplane fetch completed: ${allDataplanes.length} dataplanes across ${namespaces.length} namespaces (${totalTime}ms)`,
      );

      return allDataplanes;
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
        '/api/v1/namespaces/{namespaceName}/dataplanes',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch dataplanes for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data?.items) {
        this.logger.warn(`No dataplanes found for namespace ${namespaceName}`);
        return [];
      }

      const result = this.transformDataPlaneData(data.items, namespaceName);

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

      // Group environments by namespace-qualified dataPlaneRef key
      // Dataplanes in different namespaces can share the same name (e.g. "default"),
      // so we use "namespaceName/dataPlaneRef" as the composite key.
      const environmentsByDataPlane = new Map<string, Environment[]>();
      environments.forEach(env => {
        const key = `${env.namespaceName}/${env.dataPlaneRef}`;
        if (!environmentsByDataPlane.has(key)) {
          environmentsByDataPlane.set(key, []);
        }
        environmentsByDataPlane.get(key)!.push(env);
      });

      // Create DataPlaneWithEnvironments objects
      const dataplanesWithEnvironments: DataPlaneWithEnvironments[] =
        dataplanes.map(dataplane => ({
          ...dataplane,
          environments:
            environmentsByDataPlane.get(
              `${dataplane.namespaceName}/${dataplane.name}`,
            ) || [],
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
            // Get bindings for this component using namespace-scoped endpoint with component filter
            const bindings = await fetchAllPages<NewReleaseBinding>(cursor =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/releasebindings', {
                  params: {
                    path: {
                      namespaceName: component.namespaceName,
                    },
                    query: {
                      component: component.componentName,
                      cursor,
                    },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error('Failed to fetch release bindings');
                  return res.data!;
                }),
            );

            bindings.forEach(binding => {
              const envName = binding.spec?.environment;
              if (envName) {
                const key = `${component.namespaceName}/${envName}`;
                const currentCount = componentCountsByEnvironment.get(key) || 0;
                componentCountsByEnvironment.set(key, currentCount + 1);
              }
            });
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
            const { data, error, response } = await client.GET(
              '/api/v1/namespaces/{namespaceName}/releasebindings',
              {
                params: {
                  path: {
                    namespaceName: component.namespaceName,
                  },
                  query: {
                    component: component.componentName,
                    limit: 1, // We only need to know if at least one binding exists
                  },
                },
              },
            );

            if (!error && response.ok && data?.items && data.items.length > 0) {
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
   * Fetches count of healthy workloads across all components.
   * A workload is considered healthy if its Ready condition status is 'True'.
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
            const bindings = await fetchAllPages<NewReleaseBinding>(cursor =>
              client
                .GET('/api/v1/namespaces/{namespaceName}/releasebindings', {
                  params: {
                    path: {
                      namespaceName: component.namespaceName,
                    },
                    query: {
                      component: component.componentName,
                      cursor,
                    },
                  },
                })
                .then(res => {
                  if (res.error)
                    throw new Error('Failed to fetch release bindings');
                  return res.data!;
                }),
            );

            // Count healthy workloads by checking status conditions
            const healthyCount = bindings.filter(binding =>
              isReady(binding),
            ).length;
            return healthyCount;
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

  /**
   * Fetches the list of namespace names from the OpenChoreo API.
   */
  private async fetchNamespaceNames(userToken?: string): Promise<string[]> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token: userToken,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET('/api/v1/namespaces');

    if (error || !response.ok) {
      this.logger.error(
        `Failed to fetch namespaces: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    if (!data?.items) {
      this.logger.warn('No namespaces found');
      return [];
    }

    return data.items
      .map(ns => getName(ns))
      .filter((name): name is string => !!name);
  }

  private transformEnvironmentData(
    environmentData: NewEnvironment[],
    namespaceName: string,
  ): Environment[] {
    return environmentData.map(env => {
      const name = getName(env) || '';
      return {
        name,
        namespace: getNamespace(env) || '',
        displayName: getDisplayName(env) || name,
        description: getDescription(env) || '',
        namespaceName,
        dataPlaneRef: env.spec?.dataPlaneRef?.name || '',
        isProduction: env.spec?.isProduction ?? false,
        dnsPrefix: env.spec?.gateway?.ingress?.external?.http?.host || '',
        createdAt: getCreatedAt(env) || '',
        status: isReady(env) ? 'Ready' : 'NotReady',
      };
    });
  }

  private transformDataPlaneData(
    dataplaneData: NewDataPlane[],
    namespaceName: string,
  ): DataPlane[] {
    return dataplaneData.map(dp => {
      const gateway = dp.spec?.gateway;
      const secretStore = dp.spec?.secretStoreRef;
      const obsRef = dp.spec?.observabilityPlaneRef;
      return {
        name: getName(dp) || '',
        namespace: getNamespace(dp),
        displayName: getDisplayName(dp),
        description: getDescription(dp),
        namespaceName,
        imagePullSecretRefs: dp.spec?.imagePullSecretRefs,
        secretStoreRef: secretStore?.name,
        publicVirtualHost: gateway?.ingress?.external?.http?.host,
        namespaceVirtualHost: gateway?.ingress?.internal?.http?.host,
        publicHTTPPort: gateway?.ingress?.external?.http?.port,
        publicHTTPSPort: gateway?.ingress?.external?.https?.port,
        namespaceHTTPPort: gateway?.ingress?.internal?.http?.port,
        namespaceHTTPSPort: gateway?.ingress?.internal?.https?.port,
        observabilityPlaneRef: obsRef?.name,
        createdAt: getCreatedAt(dp),
        status: isReady(dp) ? 'Ready' : 'NotReady',
      };
    });
  }
}
