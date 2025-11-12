import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated type from OpenAPI spec
export type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['CompleteComponent'];

export class ComponentInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private token?: string;

  constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async fetchComponentDetails(
    orgName: string,
    projectName: string,
    componentName: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Fetching component details for: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
        {
          params: {
            path: { orgName, projectName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      this.logger.debug(
        `Successfully fetched component details for: ${componentName}`,
      );
      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component details for ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
