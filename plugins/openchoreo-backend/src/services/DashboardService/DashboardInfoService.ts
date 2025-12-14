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
    orgName: string,
    projectName: string,
    componentName: string,
  ): Promise<number> {
    this.logger.info(
      `Fetching bindings count for component: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      // Fetch bindings for the component
      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/bindings',
        {
          params: {
            path: {
              orgName,
              projectName,
              componentName,
            },
          },
        },
      );

      if (error || !response.ok || !data) {
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

  async fetchComponentsBindingsCount(
    components: Array<{
      orgName: string;
      projectName: string;
      componentName: string;
    }>,
  ): Promise<number> {
    this.logger.info(
      `Fetching bindings count for ${components.length} components`,
    );

    try {
      // Fetch bindings for all components in parallel
      const bindingsCounts = await Promise.all(
        components.map(({ orgName, projectName, componentName }) =>
          this.fetchDashboardMetrics(orgName, projectName, componentName),
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
