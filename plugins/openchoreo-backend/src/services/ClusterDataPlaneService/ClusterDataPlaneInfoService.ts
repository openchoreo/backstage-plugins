import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type { ClusterDataPlaneResponse } from '@openchoreo/backstage-plugin-common';
import { transformClusterDataPlane } from '../transformers';

/**
 * Service for managing and retrieving cluster data plane information.
 * This service handles fetching cluster data plane details from the OpenChoreo API.
 */
export class ClusterDataPlaneInfoService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async listClusterDataPlanes(
    token?: string,
  ): Promise<ClusterDataPlaneResponse[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('Listing cluster data planes');

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allDataPlanes = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/clusterdataplanes', {
            params: {
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error) {
              throw new Error(
                `Failed to list cluster data planes: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Cluster data planes list completed: Total: ${totalTime}ms, count: ${allDataPlanes.length}`,
      );

      return allDataPlanes.map(transformClusterDataPlane);
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error listing cluster data planes (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchClusterDataPlaneDetails(
    request: { name: string },
    token?: string,
  ): Promise<ClusterDataPlaneResponse> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching cluster data plane details for: ${request.name}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clusterdataplanes/{cdpName}',
        {
          params: {
            path: { cdpName: request.name },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch cluster data plane: ${response.status} ${response.statusText}`,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Cluster data plane fetch completed for ${request.name}: Total: ${totalTime}ms`,
      );

      return transformClusterDataPlane(data);
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching cluster data plane ${request.name} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}
