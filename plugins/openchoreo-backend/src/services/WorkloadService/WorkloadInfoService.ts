import { LoggerService } from '@backstage/backend-plugin-api';
import { WorkloadService } from '../../types';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated type from OpenAPI spec
type ModelsWorkload = OpenChoreoComponents['schemas']['WorkloadResponse'];

/**
 * Service for managing and retrieving workload information.
 * This service handles fetching and applying workload configurations.
 */
export class WorkloadInfoService implements WorkloadService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  static create(logger: LoggerService, baseUrl: string): WorkloadInfoService {
    return new WorkloadInfoService(logger, baseUrl);
  }

  /**
   * Fetches workload information for a specific component in a project.
   * First tries the dedicated workload endpoint, falls back to component endpoint if needed.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.componentName - Name of the component to fetch workload info for
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @returns {Promise<ModelsWorkload>} The workload configuration
   * @throws {Error} When there's an error fetching data from the API
   */
  async fetchWorkloadInfo(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<ModelsWorkload> {
    const { projectName, componentName, namespaceName } = request;

    try {
      this.logger.info(
        `Fetching workload info for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workloads',
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
          `Failed to fetch workload: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('No workload data returned');
      }

      return data.data;
    } catch (error) {
      this.logger.error(`Failed to fetch workload info: ${error}`);
      throw new Error('Failed to fetch workload info', { cause: error });
    }
  }

  /**
   * Applies workload configuration for a specific component in a project.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.projectName - Name of the project containing the component
   * @param {string} request.componentName - Name of the component to apply workload for
   * @param {string} request.namespaceName - Name of the namespace owning the project
   * @param {ModelsWorkload} request.workloadSpec - The workload specification to apply
   * @returns {Promise<any>} The result of the apply operation
   * @throws {Error} When there's an error applying the workload
   */
  async applyWorkload(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
      workloadSpec: ModelsWorkload;
    },
    token?: string,
  ): Promise<any> {
    const { projectName, componentName, namespaceName, workloadSpec } = request;

    try {
      this.logger.info(
        `Applying workload for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workloads',
        {
          params: {
            path: {
              namespaceName,
              projectName,
              componentName,
            },
          },
          body: workloadSpec,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update workload: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('No workload data returned');
      }

      return data.data;
    } catch (error) {
      this.logger.error(`Failed to apply workload: ${error}`);
      throw error;
    }
  }
}
