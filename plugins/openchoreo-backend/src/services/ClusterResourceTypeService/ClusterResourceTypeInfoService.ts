import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { APIResponse } from '@openchoreo/backstage-plugin-common';

type ClusterResourceTypeSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

/**
 * BFF service for cluster-scoped ClusterResourceType operations. Slice 3
 * only needs the schema fetch (consumed by the Scaffolder
 * ResourceYamlEditor).
 */
export class ClusterResourceTypeInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchClusterResourceTypeSchema(
    crtName: string,
    token?: string,
  ): Promise<ClusterResourceTypeSchemaResponse> {
    this.logger.debug(
      `Fetching schema for cluster resource type: ${crtName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clusterresourcetypes/{crtName}/schema',
        {
          params: {
            path: { crtName },
          },
        },
      );

      assertApiResponse(
        { data, error, response },
        'fetch cluster resource type schema',
      );

      this.logger.debug(
        `Successfully fetched schema for cluster resource type: ${crtName}`,
      );

      return {
        success: true,
        data: data as ClusterResourceTypeSchemaResponse['data'],
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for cluster resource type ${crtName}: ${error}`,
      );
      throw error;
    }
  }
}
