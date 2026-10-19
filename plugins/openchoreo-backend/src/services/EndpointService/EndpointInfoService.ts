import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { APIResponse } from '@openchoreo/backstage-plugin-common';
import type { ApiSchemaResponse } from '../types';

export type EndpointReleaseSchemaSection = 'parameters' | 'environmentConfigs';

/**
 * BFF service for Endpoint reads beyond the catalog entity: the immutable
 * EndpointReleases the Endpoint controller cuts, and the parameter schemas of
 * (Cluster)EndpointTypes.
 */
export class EndpointInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  private client(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  private async getEndpointRelease(
    namespaceName: string,
    releaseName: string,
    token?: string,
  ): Promise<Record<string, unknown>> {
    const { data, error, response } = await this.client(token).GET(
      '/api/v1/namespaces/{namespaceName}/endpointreleases/{endpointReleaseName}',
      {
        params: {
          path: { namespaceName, endpointReleaseName: releaseName },
        },
      },
    );
    assertApiResponse({ data, error, response }, 'fetch endpoint release');
    return data as Record<string, unknown>;
  }

  /**
   * Returns the full EndpointRelease CR, so the Deploy tab can show the
   * snapshot pinned to an environment.
   */
  async fetchEndpointRelease(
    namespaceName: string,
    releaseName: string,
    token?: string,
  ): Promise<APIResponse & { data?: Record<string, unknown> }> {
    this.logger.debug(
      `Fetching endpoint release: ${releaseName} in namespace: ${namespaceName}`,
    );
    return {
      success: true,
      data: await this.getEndpointRelease(namespaceName, releaseName, token),
    };
  }

  /**
   * Returns one schema section from the EndpointType snapshot frozen on an
   * EndpointRelease, so per-environment overrides validate against what the
   * pinned release was cut against rather than the live type.
   */
  async fetchEndpointReleaseSchema(
    namespaceName: string,
    releaseName: string,
    section: EndpointReleaseSchemaSection,
    token?: string,
  ): Promise<ApiSchemaResponse> {
    const release = await this.getEndpointRelease(
      namespaceName,
      releaseName,
      token,
    );
    const spec = (release?.spec as Record<string, unknown>) || {};
    const endpointType = (spec.endpointType as Record<string, unknown>) || {};
    const typeSpec = (endpointType.spec as Record<string, unknown>) || {};
    const sectionBlock = typeSpec[section] as
      | { openAPIV3Schema?: Record<string, unknown> }
      | undefined;

    return {
      success: true,
      // Empty when the type declares no such section, so form code can
      // render its empty state without special-casing.
      data: (sectionBlock?.openAPIV3Schema ?? {}) as ApiSchemaResponse['data'],
    };
  }

  /** Returns the parameters schema of a namespace-scoped EndpointType. */
  async fetchEndpointTypeSchema(
    namespaceName: string,
    etName: string,
    token?: string,
  ): Promise<ApiSchemaResponse> {
    const { data, error, response } = await this.client(token).GET(
      '/api/v1/namespaces/{namespaceName}/endpointtypes/{etName}/schema',
      { params: { path: { namespaceName, etName } } },
    );
    assertApiResponse({ data, error, response }, 'fetch endpoint type schema');
    return { success: true, data: data as ApiSchemaResponse['data'] };
  }

  /** Returns the parameters schema of a ClusterEndpointType. */
  async fetchClusterEndpointTypeSchema(
    cetName: string,
    token?: string,
  ): Promise<ApiSchemaResponse> {
    const { data, error, response } = await this.client(token).GET(
      '/api/v1/clusterendpointtypes/{cetName}/schema',
      { params: { path: { cetName } } },
    );
    assertApiResponse(
      { data, error, response },
      'fetch cluster endpoint type schema',
    );
    return { success: true, data: data as ApiSchemaResponse['data'] };
  }
}
