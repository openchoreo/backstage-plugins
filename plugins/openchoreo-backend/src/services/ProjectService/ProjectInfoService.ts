import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated types from OpenAPI spec
export type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
export type ModelsDeploymentPipeline =
  OpenChoreoComponents['schemas']['DeploymentPipelineResponse'];

export class ProjectInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private token?: string;

  constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async fetchProjectDetails(
    orgName: string,
    projectName: string,
  ): Promise<ModelsProject> {
    this.logger.debug(
      `Fetching project details for: ${projectName} in organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}',
        {
          params: {
            path: { orgName, projectName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch project: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      this.logger.debug(
        `Successfully fetched project details for: ${projectName}`,
      );
      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch project details for ${projectName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchProjectDeploymentPipeline(
    orgName: string,
    projectName: string,
  ): Promise<ModelsDeploymentPipeline> {
    this.logger.debug(
      `Fetching deployment pipeline for project: ${projectName} in organization: ${orgName}`,
    );
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/deployment-pipeline',
        {
          params: {
            path: { orgName, projectName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch deployment pipeline: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      this.logger.debug(
        `Successfully fetched deployment pipeline for project: ${projectName}`,
      );
      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch deployment pipeline for ${projectName}: ${error}`,
      );
      throw error;
    }
  }
}
