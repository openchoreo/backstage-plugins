import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import type {
  ProjectResponse,
  DeploymentPipelineResponse,
} from '@openchoreo/backstage-plugin-common';
import { transformProject, transformDeploymentPipeline } from '../transformers';

export type ModelsProject = ProjectResponse;
export type ModelsDeploymentPipeline = DeploymentPipelineResponse;

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
    this.logger.debug(
      `Fetching deployment pipeline for project: ${projectName} in namespace: ${namespaceName}`,
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
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
        {
          params: {
            path: { namespaceName, deploymentPipelineName: pipelineName },
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

      this.logger.info(`Successfully deleted project: ${projectName}`);
    } catch (error) {
      this.logger.error(`Failed to delete project ${projectName}: ${error}`);
      throw error;
    }
  }
}
