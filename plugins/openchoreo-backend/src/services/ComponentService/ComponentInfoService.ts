import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated type from OpenAPI spec
export type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];

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
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Fetching component details for: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, projectName, componentName },
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
    projectName: string,
    componentName: string,
    autoDeploy: boolean,
    token?: string,
  ): Promise<ModelsCompleteComponent> {
    this.logger.debug(
      `Patching component: ${componentName} in project: ${projectName}, namespace: ${namespaceName} with autoDeploy: ${autoDeploy}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.PATCH(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, projectName, componentName },
          },
          body: {
            autoDeploy,
          },
        },
      );

      if (error || !response.ok || !data) {
        throw new Error(
          `Failed to patch component: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      this.logger.debug(`Successfully patched component: ${componentName}`);
      return data.data;
    } catch (error) {
      this.logger.error(`Failed to patch component ${componentName}: ${error}`);
      throw error;
    }
  }

  /**
   * Deletes a component in OpenChoreo API.
   *
   * @param orgName - Organization name
   * @param projectName - Project name
   * @param componentName - Component name
   * @param token - Optional user token (overrides default token if provided)
   */
  async deleteComponent(
    orgName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<void> {
    this.logger.info(
      `Deleting component: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
        {
          params: {
            path: { orgName, projectName, componentName },
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
