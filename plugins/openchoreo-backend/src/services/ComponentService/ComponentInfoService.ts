import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import type { ComponentResponse } from '@openchoreo/backstage-plugin-common';
import { transformComponent } from '../transformers';

export type ModelsCompleteComponent = ComponentResponse;

export class ComponentInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches component details from OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param token - Optional user token (overrides default token if provided)
   */
  async fetchComponentDetails(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Fetching component details for: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // New API: components are at namespace level, not nested under projects
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched component details for: ${componentName}`,
      );
      return transformComponent(data);
    } catch (error) {
      this.logger.error(
        `Failed to fetch component details for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Patches a component in OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param autoDeploy - Auto deploy setting
   * @param token - Optional user token (overrides default token if provided)
   */
  async patchComponent(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    autoDeploy: boolean,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Patching component: ${componentName} in namespace: ${namespaceName} with autoDeploy: ${autoDeploy}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // New API uses PUT for full update. First GET the component, then PUT with modified autoDeploy.
      const {
        data: existing,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      if (getError || !getResponse.ok) {
        throw new Error(
          `Failed to fetch component for patch: ${getResponse.status} ${getResponse.statusText}`,
        );
      }

      const updated = {
        ...existing,
        spec: {
          ...existing.spec!,
          autoDeploy,
        },
      };

      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
          body: updated,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to patch component: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(`Successfully patched component: ${componentName}`);
      return transformComponent(data);
    } catch (error) {
      this.logger.error(`Failed to patch component ${componentName}: ${error}`);
      throw error;
    }
  }

  /**
   * Deletes a component in OpenChoreo API.
   *
   * @param namespaceName - Namespace name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param token - Optional user token (overrides default token if provided)
   */
  async deleteComponent(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<void> {
    this.logger.info(
      `Deleting component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      // New API: components at namespace level
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to delete component: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.info(`Successfully deleted component: ${componentName}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete component ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
