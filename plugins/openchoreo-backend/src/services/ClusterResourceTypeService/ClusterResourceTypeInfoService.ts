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

/** An output entry declared on a (Cluster)ResourceType. The "kind" is implicit
 * in which of value / secretKeyRef / configMapKeyRef is set. */
type ResourceTypeOutput = {
  name: string;
  value?: string;
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
};

/** APIResponse.data is record-shaped; outputs is array-shaped, so we
 * declare this as a sibling interface rather than extending APIResponse. */
interface ClusterResourceTypeOutputsResponse {
  success: boolean;
  data?: ResourceTypeOutput[];
  error?: string;
  code?: string;
}

/**
 * BFF service for cluster-scoped ClusterResourceType operations. Today
 * the schema fetch is consumed by the catalog backend's
 * RtdToTemplateConverter to bake the parameters schema into the per-type
 * Resource scaffolder template (both on periodic refresh and per-event
 * delta updates).
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
    this.logger.debug(`Fetching schema for cluster resource type: ${crtName}`);

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

  /**
   * Returns the declared outputs[] for a ClusterResourceType. Mirrors the
   * namespace-scoped sibling on ResourceTypeInfoService. Fetches the full
   * resource and returns spec.outputs (empty array when absent); the
   * openchoreo-api has no dedicated /outputs endpoint.
   */
  async fetchClusterResourceTypeOutputs(
    crtName: string,
    token?: string,
  ): Promise<ClusterResourceTypeOutputsResponse> {
    this.logger.debug(`Fetching outputs for cluster resource type: ${crtName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clusterresourcetypes/{crtName}',
        {
          params: {
            path: { crtName },
          },
        },
      );

      assertApiResponse(
        { data, error, response },
        'fetch cluster resource type outputs',
      );

      const outputs =
        (data as { spec?: { outputs?: ResourceTypeOutput[] } })?.spec
          ?.outputs ?? [];

      this.logger.debug(
        `Successfully fetched ${outputs.length} output(s) for cluster resource type: ${crtName}`,
      );

      return {
        success: true,
        data: outputs,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch outputs for cluster resource type ${crtName}: ${error}`,
      );
      throw error;
    }
  }
}
