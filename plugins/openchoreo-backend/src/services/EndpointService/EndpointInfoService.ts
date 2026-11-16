import { LoggerService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  MAX_ENDPOINT_BACKENDS,
  deriveEndpointBackendName,
  endpointBackendsTakeTraffic,
  type APIResponse,
} from '@openchoreo/backstage-plugin-common';
import type { ApiSchemaResponse } from '../types';

type EndpointBackendRef = OpenChoreoComponents['schemas']['EndpointBackendRef'];

/** Identifies an Endpoint by namespace and name. */
export interface EndpointRef {
  namespaceName: string;
  endpointName: string;
}

function requireBackend(
  refs: EndpointBackendRef[],
  request: EndpointRef & { backendName: string },
) {
  if (!refs.some(ref => ref.name === request.backendName)) {
    throw new InputError(
      `Endpoint ${request.endpointName} has no backend ${request.backendName}`,
    );
  }
}

function requireTraffic(refs: EndpointBackendRef[], endpointName: string) {
  if (!endpointBackendsTakeTraffic(refs)) {
    throw new InputError(
      `At least one backend of Endpoint ${endpointName} needs a weight above 0`,
    );
  }
}

/**
 * BFF service for Endpoint reads beyond the catalog entity: the immutable
 * EndpointReleases the Endpoint controller cuts, and the environmentConfigs
 * schema frozen on each. Also changes an Endpoint's backends.
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
   * Returns the environmentConfigs schema from the EndpointType snapshot
   * frozen on an EndpointRelease, so per-environment overrides validate
   * against what the pinned release was cut against rather than the live type.
   */
  async fetchEndpointReleaseSchema(
    namespaceName: string,
    releaseName: string,
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
    const environmentConfigs = typeSpec.environmentConfigs as
      | { openAPIV3Schema?: Record<string, unknown> }
      | undefined;

    return {
      success: true,
      // Empty when the type declares no environmentConfigs, so form code can
      // render its empty state without special-casing.
      data: (environmentConfigs?.openAPIV3Schema ??
        {}) as ApiSchemaResponse['data'],
    };
  }

  /**
   * Adds a backend to an Endpoint, routing part of its traffic to a
   * component's workload endpoint. When the Endpoint belongs to a component
   * and the new backend is on another one, the API moves the Endpoint to its
   * project.
   */
  async addEndpointBackend(
    request: EndpointRef & {
      component: string;
      workloadEndpoint: string;
      weight?: number;
    },
    token?: string,
  ): Promise<{ name: string; backendName: string }> {
    let backendName = '';
    await this.updateEndpointBackends(
      request,
      token,
      'add endpoint backend',
      refs => {
        if (refs.length >= MAX_ENDPOINT_BACKENDS) {
          throw new InputError(
            `Endpoint ${request.endpointName} already has the maximum of ${MAX_ENDPOINT_BACKENDS} backends`,
          );
        }
        if (
          refs.some(
            ref =>
              ref.component?.name === request.component &&
              ref.component?.endpoint === request.workloadEndpoint,
          )
        ) {
          throw new InputError(
            `Endpoint ${request.endpointName} already routes to ${request.component}/${request.workloadEndpoint}`,
          );
        }
        backendName = deriveEndpointBackendName(
          request.component,
          request.workloadEndpoint,
          refs.map(ref => ref.name),
        );
        return [
          ...refs,
          {
            name: backendName,
            kind: 'Component',
            component: {
              name: request.component,
              endpoint: request.workloadEndpoint,
            },
            weight: request.weight ?? 1,
          },
        ];
      },
    );
    return { name: request.endpointName, backendName };
  }

  /** Sets the weight of one of an Endpoint's backends. */
  async updateEndpointBackendWeight(
    request: EndpointRef & { backendName: string; weight: number },
    token?: string,
  ): Promise<{ success: true }> {
    await this.updateEndpointBackends(
      request,
      token,
      'update endpoint backend weight',
      refs => {
        requireBackend(refs, request);
        return refs.map(ref =>
          ref.name === request.backendName
            ? { ...ref, weight: request.weight }
            : ref,
        );
      },
    );
    return { success: true };
  }

  /**
   * Removes one of an Endpoint's backends. An Endpoint needs at least one,
   * so the last can't be removed; delete the Endpoint instead. An Endpoint
   * that already moved to its project stays there.
   */
  async removeEndpointBackend(
    request: EndpointRef & { backendName: string },
    token?: string,
  ): Promise<{ success: true }> {
    await this.updateEndpointBackends(
      request,
      token,
      'remove endpoint backend',
      refs => {
        requireBackend(refs, request);
        if (refs.length === 1) {
          throw new InputError(
            `Endpoint ${request.endpointName} needs at least one backend; delete the Endpoint instead`,
          );
        }
        return refs.filter(ref => ref.name !== request.backendName);
      },
    );
    return { success: true };
  }

  /**
   * Reads an Endpoint, lets `change` compute its new backends, and writes it
   * back. Rejects backends that would send no traffic. The API applies the
   * update to the Endpoint as it is then, so it detects no concurrent edits.
   */
  private async updateEndpointBackends(
    request: EndpointRef,
    token: string | undefined,
    action: string,
    change: (refs: EndpointBackendRef[]) => EndpointBackendRef[],
  ): Promise<void> {
    const client = this.client(token);
    const path = {
      namespaceName: request.namespaceName,
      endpointName: request.endpointName,
    };
    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      { params: { path } },
    );
    assertApiResponse({ data, error, response }, 'fetch endpoint');
    const endpoint = data!;
    if (!endpoint.spec) {
      throw new InputError(`Endpoint ${request.endpointName} has no spec`);
    }
    const backendRefs = change(endpoint.spec.backendRefs ?? []);
    requireTraffic(backendRefs, request.endpointName);
    const updated = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      {
        params: { path },
        body: {
          metadata: endpoint.metadata,
          spec: { ...endpoint.spec, backendRefs },
        },
      },
    );
    assertApiResponse(updated, action);
  }
}
