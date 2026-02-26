import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type {
  APIResponse,
  ListResponse,
  ClusterTraitResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getDisplayName,
  getDescription,
  getCreatedAt,
} from '../transformers/common';

type ClusterTraitListResponse = APIResponse & {
  data?: ListResponse & {
    items?: ClusterTraitResponse[];
  };
};

type ClusterTraitSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

export class ClusterTraitInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchClusterTraits(token?: string): Promise<ClusterTraitListResponse> {
    this.logger.debug('Fetching cluster traits');

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allTraits = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/clustertraits', {
            params: {
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error) {
              throw new Error(
                `Failed to fetch cluster traits: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const items = allTraits.map(trait => ({
        name: getName(trait) ?? '',
        displayName: getDisplayName(trait),
        description: getDescription(trait),
        createdAt: getCreatedAt(trait) ?? '',
      }));

      this.logger.debug(`Successfully fetched ${items.length} cluster traits`);

      return {
        success: true,
        data: {
          items,
          totalCount: items.length,
        },
      } as ClusterTraitListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch cluster traits: ${error}`);
      throw error;
    }
  }

  async fetchClusterTraitSchema(
    clusterTraitName: string,
    token?: string,
  ): Promise<ClusterTraitSchemaResponse> {
    this.logger.debug(`Fetching schema for cluster trait: ${clusterTraitName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clustertraits/{clusterTraitName}/schema',
        {
          params: {
            path: { clusterTraitName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch cluster trait schema: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched schema for cluster trait: ${clusterTraitName}`,
      );

      return {
        success: true,
        data: data,
      } as ClusterTraitSchemaResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for cluster trait ${clusterTraitName}: ${error}`,
      );
      throw error;
    }
  }
}
