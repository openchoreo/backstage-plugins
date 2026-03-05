import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type { DataPlaneResponse } from '@openchoreo/backstage-plugin-common';
import { transformDataPlane } from '../transformers';

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

  async listDataPlanes(
    namespaceName: string,
    token?: string,
  ): Promise<DataPlaneResponse[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(`Listing data planes for namespace: ${namespaceName}`);

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allDataPlanes = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/dataplanes', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error) {
              throw new Error(
                `Failed to list data planes: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Data planes list completed for ${namespaceName}: Total: ${totalTime}ms, count: ${allDataPlanes.length}`,
      );

      return allDataPlanes.map(transformDataPlane);
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

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
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

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Data plane fetch completed for ${request.dataplaneName}: Total: ${totalTime}ms`,
      );

      return transformDataPlane(data);
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
