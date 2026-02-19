import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  fetchAllPages,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { transformDataPlane } from '../transformers';

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
  private readonly useNewApi: boolean;

  public constructor(
    logger: LoggerService,
    baseUrl: string,
    useNewApi = false,
  ) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  static create(
    logger: LoggerService,
    baseUrl: string,
    useNewApi = false,
  ): DataPlaneInfoService {
    return new DataPlaneInfoService(logger, baseUrl, useNewApi);
  }

  async listDataPlanes(
    namespaceName: string,
    token?: string,
  ): Promise<DataPlaneResponse[]> {
    if (this.useNewApi) {
      return this.listDataPlanesNew(namespaceName, token);
    }
    return this.listDataPlanesLegacy(namespaceName, token);
  }

  private async listDataPlanesLegacy(
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

  private async listDataPlanesNew(
    namespaceName: string,
    token?: string,
  ): Promise<DataPlaneResponse[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Listing data planes (new API) for namespace: ${namespaceName}`,
      );

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
    if (this.useNewApi) {
      return this.fetchDataPlaneDetailsNew(request, token);
    }
    return this.fetchDataPlaneDetailsLegacy(request, token);
  }

  private async fetchDataPlaneDetailsLegacy(
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

  private async fetchDataPlaneDetailsNew(
    request: {
      namespaceName: string;
      dataplaneName: string;
    },
    token?: string,
  ): Promise<DataPlaneResponse> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching data plane details (new API) for: ${request.dataplaneName} in namespace: ${request.namespaceName}`,
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
