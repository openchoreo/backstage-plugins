import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { transformProject, transformDeploymentPipeline } from '../transformers';

// Use the generated types from OpenAPI spec
export type ModelsProject =
  OpenChoreoLegacyComponents['schemas']['ProjectResponse'];
export type ModelsDeploymentPipeline =
  OpenChoreoLegacyComponents['schemas']['DeploymentPipelineResponse'];

export class ProjectInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  async fetchProjectDetails(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ModelsProject> {
    if (this.useNewApi) {
      return this.fetchProjectDetailsNew(namespaceName, projectName, token);
    }
    return this.fetchProjectDetailsLegacy(namespaceName, projectName, token);
  }

  private async fetchProjectDetailsLegacy(
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

  private async fetchProjectDetailsNew(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ModelsProject> {
    this.logger.debug(
      `Fetching project details (new API) for: ${projectName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
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

      this.logger.debug(
        `Successfully fetched project details for: ${projectName}`,
      );
      return transformProject(data);
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
    if (this.useNewApi) {
      return this.fetchProjectDeploymentPipelineNew(
        namespaceName,
        projectName,
        token,
      );
    }
    return this.fetchProjectDeploymentPipelineLegacy(
      namespaceName,
      projectName,
      token,
    );
  }

  private async fetchProjectDeploymentPipelineLegacy(
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

  private async fetchProjectDeploymentPipelineNew(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ModelsDeploymentPipeline> {
    this.logger.debug(
      `Fetching deployment pipeline (new API) for project: ${projectName} in namespace: ${namespaceName}`,
    );
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // First fetch the project to get the deploymentPipelineRef
      const {
        data: project,
        error: projectError,
        response: projectResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
        {
          params: { path: { namespaceName, projectName } },
        },
      );

      if (projectError || !projectResponse.ok) {
        throw new Error(
          `Failed to fetch project: ${projectResponse.status} ${projectResponse.statusText}`,
        );
      }

      const pipelineName = project.spec?.deploymentPipelineRef;
      if (!pipelineName) {
        throw new Error(
          `Project ${projectName} has no deployment pipeline reference`,
        );
      }

      // Then fetch the deployment pipeline by name
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/deployment-pipelines/{pipelineName}',
        {
          params: {
            path: { namespaceName, pipelineName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch deployment pipeline: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched deployment pipeline for project: ${projectName}`,
      );
      return transformDeploymentPipeline(data);
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
      if (this.useNewApi) {
        const client = createOpenChoreoApiClient({
          baseUrl: this.baseUrl,
          token,
          logger: this.logger,
        });

        const { error, response } = await client.DELETE(
          '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
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
      } else {
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
      }

      this.logger.info(`Successfully deleted project: ${projectName}`);
    } catch (error) {
      this.logger.error(`Failed to delete project ${projectName}: ${error}`);
      throw error;
    }
  }
}
