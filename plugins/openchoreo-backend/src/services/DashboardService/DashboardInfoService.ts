import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';

export interface DashboardMetrics {
  totalBindings: number;
}

export class DashboardInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchDashboardMetrics(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    token?: string,
  ): Promise<number> {
    this.logger.info(
      `Fetching release bindings count for component: ${componentName} in namespace: ${namespaceName}`,
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
            path: { namespaceName },
            query: { component: componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch release bindings: ${response.status} ${response.statusText}`,
        );
      }

      const bindingsCount = data.items.length;

      this.logger.info(
        `Successfully fetched ${bindingsCount} release bindings for component: ${componentName}`,
      );

      return bindingsCount;
    } catch (error) {
      this.logger.error(
        `Failed to fetch release bindings for component ${componentName}: ${error}`,
      );
      // Return 0 instead of throwing to allow partial results
      return 0;
    }
  }

  async fetchComponentsBindingsCount(
    components: Array<{
      namespaceName: string;
      projectName: string;
      componentName: string;
    }>,
    token?: string,
  ): Promise<number> {
    this.logger.info(
      `Fetching bindings count for ${components.length} components`,
    );

    try {
      // Fetch bindings for all components in parallel
      const bindingsCounts = await Promise.all(
        components.map(({ namespaceName, projectName, componentName }) =>
          this.fetchDashboardMetrics(
            namespaceName,
            projectName,
            componentName,
            token,
          ),
        ),
      );

      // Sum up all bindings
      const totalBindings = bindingsCounts.reduce(
        (sum, count) => sum + count,
        0,
      );

      this.logger.info(
        `Total bindings across ${components.length} components: ${totalBindings}`,
      );

      return totalBindings;
    } catch (error) {
      this.logger.error(`Failed to fetch total bindings count: ${error}`);
      throw error;
    }
  }
}
