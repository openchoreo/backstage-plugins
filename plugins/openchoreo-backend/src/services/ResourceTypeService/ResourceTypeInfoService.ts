import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { APIResponse } from '@openchoreo/backstage-plugin-common';

type ResourceTypeSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

/**
 * BFF service for namespace-scoped ResourceType operations. Today the
 * schema fetch is consumed by the catalog backend's RtdToTemplateConverter
 * to bake the parameters schema into the per-type Resource scaffolder
 * template (both on periodic refresh and per-event delta updates).
 * Other CRUD already flows through PlatformResourceService.
 */
export class ResourceTypeInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchResourceTypeSchema(
    namespaceName: string,
    rtName: string,
    token?: string,
  ): Promise<ResourceTypeSchemaResponse> {
    this.logger.debug(
      `Fetching schema for resource type: ${rtName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}/schema',
        {
          params: {
            path: { namespaceName, rtName },
          },
        },
      );

      assertApiResponse(
        { data, error, response },
        'fetch resource type schema',
      );

      this.logger.debug(
        `Successfully fetched schema for resource type: ${rtName}`,
      );

      return {
        success: true,
        data: data as ResourceTypeSchemaResponse['data'],
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for resource type ${rtName}: ${error}`,
      );
      throw error;
    }
  }
}
