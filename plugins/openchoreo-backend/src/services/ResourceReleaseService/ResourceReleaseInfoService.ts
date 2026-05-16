import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { APIResponse } from '@openchoreo/backstage-plugin-common';

type ResourceReleaseSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

export type ResourceReleaseSchemaSection = 'parameters' | 'environmentConfigs';

/**
 * BFF service for ResourceRelease reads. Frozen snapshots that the
 * Resource controller cuts whenever Resource.spec + (Cluster)ResourceType.spec
 * change. Reads here surface the snapshot (Cluster)ResourceType schemas so
 * the override wizard can validate against what a release was actually cut
 * against, not the live type which may have drifted.
 */
export class ResourceReleaseInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Returns the requested schema section from the frozen snapshot stored on
   * a ResourceRelease. `parameters` is the developer-facing schema bound to
   * Resource.spec.parameters; `environmentConfigs` is the per-env override
   * schema bound to ResourceReleaseBinding.spec.resourceTypeEnvironmentConfigs.
   */
  async fetchResourceReleaseSchema(
    namespaceName: string,
    releaseName: string,
    section: ResourceReleaseSchemaSection,
    token?: string,
  ): Promise<ResourceReleaseSchemaResponse> {
    this.logger.debug(
      `Fetching snapshot schema (${section}) for resource release: ${releaseName} in namespace: ${namespaceName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/resourcereleases/{resourceReleaseName}',
      {
        params: {
          path: { namespaceName, resourceReleaseName: releaseName },
        },
      },
    );

    assertApiResponse({ data, error, response }, 'fetch resource release');

    const release = data as Record<string, unknown> | undefined;
    const spec = (release?.spec as Record<string, unknown>) || {};
    const resourceType = (spec.resourceType as Record<string, unknown>) || {};
    const typeSpec = (resourceType.spec as Record<string, unknown>) || {};
    const sectionBlock = typeSpec[section] as
      | { openAPIV3Schema?: Record<string, unknown> }
      | undefined;
    const schema = sectionBlock?.openAPIV3Schema;

    return {
      success: true,
      // Empty schema when the section isn't defined — keeps the caller's
      // form code uniform; it renders an empty-state message in that case.
      data: (schema ?? {}) as ResourceReleaseSchemaResponse['data'],
    };
  }
}
