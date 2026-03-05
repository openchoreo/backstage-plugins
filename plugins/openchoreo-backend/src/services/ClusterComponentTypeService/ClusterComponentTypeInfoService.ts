import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type {
  APIResponse,
  ListResponse,
  ClusterComponentTypeResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getDisplayName,
  getDescription,
  getCreatedAt,
} from '../transformers/common';

type ClusterComponentTypeListResponse = APIResponse & {
  data?: ListResponse & {
    items?: ClusterComponentTypeResponse[];
  };
};

type ClusterComponentTypeSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

export class ClusterComponentTypeInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchClusterComponentTypes(
    token?: string,
  ): Promise<ClusterComponentTypeListResponse> {
    this.logger.debug('Fetching cluster component types');

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allTypes = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/clustercomponenttypes', {
            params: {
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error) {
              throw new Error(
                `Failed to fetch cluster component types: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const items = allTypes.map(ct => ({
        name: getName(ct) ?? '',
        displayName: getDisplayName(ct),
        description: getDescription(ct),
        workloadType: ct.spec?.workloadType ?? '',
        allowedWorkflows: ct.spec?.allowedWorkflows,
        allowedTraits: ct.spec?.allowedTraits,
        createdAt: getCreatedAt(ct) ?? '',
      }));

      this.logger.debug(
        `Successfully fetched ${items.length} cluster component types`,
      );

      return {
        success: true,
        data: {
          items,
          totalCount: items.length,
        },
      } as ClusterComponentTypeListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch cluster component types: ${error}`);
      throw error;
    }
  }

  async fetchClusterComponentTypeSchema(
    cctName: string,
    token?: string,
  ): Promise<ClusterComponentTypeSchemaResponse> {
    this.logger.debug(`Fetching schema for cluster component type: ${cctName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clustercomponenttypes/{cctName}/schema',
        {
          params: {
            path: { cctName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch cluster component type schema: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched schema for cluster component type: ${cctName}`,
      );

      return {
        success: true,
        data: data,
      } as ClusterComponentTypeSchemaResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for cluster component type ${cctName}: ${error}`,
      );
      throw error;
    }
  }
}
