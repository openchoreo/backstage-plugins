import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated types from OpenAPI spec
export type ModelsProject =
  OpenChoreoLegacyComponents['schemas']['ProjectResponse'];
export type ModelsDeploymentPipeline =
  OpenChoreoLegacyComponents['schemas']['DeploymentPipelineResponse'];

export class ProjectInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchProjectDetails(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ModelsProject> {
    this.logger.debug(
      `Fetching project details for: ${projectName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}',
        {
          params: {
            path: { namespaceName, projectName },
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
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ModelsDeploymentPipeline> {
    this.logger.debug(
      `Fetching deployment pipeline for project: ${projectName} in namespace: ${namespaceName}`,
    );
    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/deployment-pipeline',
        {
          params: {
            path: { namespaceName, projectName },
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

  /**
   * Deletes a project in OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param token - Optional user token (overrides default token if provided)
   */
  async deleteProject(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<void> {
    this.logger.info(
      `Deleting project: ${projectName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/namespaces/{namespaceName}/projects/{projectName}',
        {
          params: {
            path: { namespaceName, projectName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to delete project: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.info(`Successfully deleted project: ${projectName}`);
    } catch (error) {
      this.logger.error(`Failed to delete project ${projectName}: ${error}`);
      throw error;
    }
  }
}
