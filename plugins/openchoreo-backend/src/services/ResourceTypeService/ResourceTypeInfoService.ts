import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type {
  ApiSchemaResponse,
  ResourceTypeOutput,
  ResourceTypeOutputsResponse,
} from '../types';

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
  ): Promise<ApiSchemaResponse> {
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
        data: data as ApiSchemaResponse['data'],
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for resource type ${rtName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Returns the declared outputs[] for a namespace-scoped ResourceType. The
   * resource-dependency editor uses this to render one row per output with
   * the appropriate env/file binding controls. The openchoreo-api has no
   * dedicated /outputs endpoint, so this fetches the full ResourceType and
   * extracts spec.outputs (empty array when absent).
   */
  async fetchResourceTypeOutputs(
    namespaceName: string,
    rtName: string,
    token?: string,
  ): Promise<ResourceTypeOutputsResponse> {
    this.logger.debug(
      `Fetching outputs for resource type: ${rtName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}',
        {
          params: {
            path: { namespaceName, rtName },
          },
        },
      );

      assertApiResponse(
        { data, error, response },
        'fetch resource type outputs',
      );

      const outputs =
        (data as { spec?: { outputs?: ResourceTypeOutput[] } })?.spec
          ?.outputs ?? [];

      this.logger.debug(
        `Successfully fetched ${outputs.length} output(s) for resource type: ${rtName}`,
      );

      return {
        success: true,
        data: outputs,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch outputs for resource type ${rtName}: ${error}`,
      );
      throw error;
    }
  }
}
