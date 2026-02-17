import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type DataPlaneResponse =
  OpenChoreoLegacyComponents['schemas']['DataPlaneResponse'];

/**
 * Service for managing and retrieving data plane information.
 * This service handles fetching data plane details from the OpenChoreo API.
 * All methods require a user token to be passed for authentication.
 */
export class DataPlaneInfoService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  static create(logger: LoggerService, baseUrl: string): DataPlaneInfoService {
    return new DataPlaneInfoService(logger, baseUrl);
  }

  /**
   * Fetches details for a specific data plane.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.namespaceName - Name of the namespace owning the data plane
   * @param {string} request.dataplaneName - Name of the data plane to fetch
   * @param {string} [token] - Optional user token for authentication
   * @returns {Promise<DataPlaneResponse>} Data plane details
   * @throws {Error} When there's an error fetching data from the API
   */
  async listDataPlanes(
    namespaceName: string,
    token?: string,
  ): Promise<DataPlaneResponse[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(`Listing data planes for namespace: ${namespaceName}`);

      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/dataplanes',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to list data planes: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('Invalid response from OpenChoreo API');
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Data planes list completed for ${namespaceName}: Total: ${totalTime}ms`,
      );

      const listData = data.data as { items?: DataPlaneResponse[] };
      return listData.items ?? [];
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error listing data planes for ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchDataPlaneDetails(
    request: {
      namespaceName: string;
      dataplaneName: string;
    },
    token?: string,
  ): Promise<DataPlaneResponse> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching data plane details for: ${request.dataplaneName} in namespace: ${request.namespaceName}`,
      );

      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/dataplanes/{dpName}',
        {
          params: {
            path: {
              namespaceName: request.namespaceName,
              dpName: request.dataplaneName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch data plane: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('Invalid response from OpenChoreo API');
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Data plane fetch completed for ${request.dataplaneName}: Total: ${totalTime}ms`,
      );

      return data.data as DataPlaneResponse;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching data plane ${request.dataplaneName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}
