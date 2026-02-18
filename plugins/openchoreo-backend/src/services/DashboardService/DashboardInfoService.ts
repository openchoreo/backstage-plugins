import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
} from '@openchoreo/openchoreo-client-node';

export interface DashboardMetrics {
  totalBindings: number;
}

export class DashboardInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  async fetchDashboardMetrics(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<number> {
    if (this.useNewApi) {
      return this.fetchDashboardMetricsNew(namespaceName, componentName, token);
    }
    return this.fetchDashboardMetricsLegacy(
      namespaceName,
      projectName,
      componentName,
      token,
    );
  }

  private async fetchDashboardMetricsLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<number> {
    this.logger.info(
      `Fetching bindings count for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch bindings for the component
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/bindings',
        {
          params: {
            path: {
              namespaceName,
              projectName,
              componentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch bindings: ${response.status} ${response.statusText}`,
        );
      }

      const bindings = data.success && data.data?.items ? data.data.items : [];

      const bindingsCount = bindings.length;

      this.logger.info(
        `Successfully fetched ${bindingsCount} bindings for component: ${componentName}`,
      );

      return bindingsCount;
    } catch (error) {
      this.logger.error(
        `Failed to fetch bindings for component ${componentName}: ${error}`,
      );
      // Return 0 instead of throwing to allow partial results
      return 0;
    }
  }

  private async fetchDashboardMetricsNew(
    namespaceName: string,
    componentName: string,
    token?: string,
  ): Promise<number> {
    this.logger.info(
      `Fetching release bindings count (new API) for component: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/release-bindings',
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
