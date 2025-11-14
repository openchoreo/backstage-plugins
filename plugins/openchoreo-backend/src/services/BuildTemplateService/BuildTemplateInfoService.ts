import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated type from OpenAPI spec
type ModelsBuildTemplate =
  OpenChoreoComponents['schemas']['BuildTemplateResponse'];

export class BuildTemplateInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchBuildTemplates(orgName: string): Promise<ModelsBuildTemplate[]> {
    this.logger.debug(`Fetching build templates for organization: ${orgName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/build-templates',
        {
          params: { path: { orgName } },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch build templates: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      const buildTemplates = data.data.items || [];

      this.logger.debug(
        `Successfully fetched ${buildTemplates.length} build templates for org: ${orgName}`,
      );
      return buildTemplates;
    } catch (error) {
      this.logger.error(
        `Failed to fetch build templates for org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

}
