import { LoggerService } from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError } from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  MAX_ENDPOINT_BACKENDS,
  buildComponentEndpoint,
  componentEndpointName,
  deriveEndpointBackendName,
  endpointBackendsTakeTraffic,
  endpointManagingComponent,
  endpointManagingReleaseLine,
  isLegacyEndpointsComponentType,
  isSameReleaseLine,
  releaseLineEndpointInputs,
  toStoredReleaseLine,
  type APIResponse,
  type AllowedEndpointTypeEntry,
  type ComponentEndpointInput,
  type ComponentEndpointSummary,
  type EndpointTypeKind,
} from '@openchoreo/backstage-plugin-common';
import type { ApiSchemaResponse } from '../types';
import {
  listComponentEndpoints,
  toComponentEndpointSummary,
  type ComponentRef,
} from './componentEndpoints';

type EndpointBackendRef = OpenChoreoComponents['schemas']['EndpointBackendRef'];

/** Identifies an Endpoint by namespace and name. */
export interface EndpointRef {
  namespaceName: string;
  endpointName: string;
}

/** Names a component's line in messages: the component for its main line. */
function lineSubject(request: ComponentRef): string {
  const line = toStoredReleaseLine(request.releaseLine);
  return line
    ? `release line ${line} of component ${request.componentName}`
    : `component ${request.componentName}`;
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
 * schema frozen on each. Also changes an Endpoint's backends, and manages the
 * Endpoints a component, or one of its release lines, owns.
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

  /**
   * Returns a component's own Endpoints together with its
   * (Cluster)ComponentType's endpoint policy: the allowedEndpoints, which
   * decide what can be added, and whether the type stays on legacy endpoints
   * (see LEGACY_ENDPOINTS_ANNOTATION), which decides the configure page's
   * form. The policy decides what saving does, so a ComponentType that can't
   * be read is an error rather than an empty policy.
   */
  async fetchComponentEndpoints(
    request: ComponentRef & {
      componentTypeKind: 'ComponentType' | 'ClusterComponentType';
      componentTypeName: string;
    },
    token?: string,
  ): Promise<{
    endpoints: ComponentEndpointSummary[];
    allowedEndpoints: AllowedEndpointTypeEntry[];
    legacyEndpoints: boolean;
  }> {
    const client = this.client(token);
    const [endpoints, policy] = await Promise.all([
      listComponentEndpoints(client, request),
      this.fetchEndpointPolicy(client, request),
    ]);
    return {
      endpoints: endpoints
        .map(toComponentEndpointSummary)
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...policy,
    };
  }

  private async fetchEndpointPolicy(
    client: ReturnType<EndpointInfoService['client']>,
    request: {
      namespaceName: string;
      componentTypeKind: 'ComponentType' | 'ClusterComponentType';
      componentTypeName: string;
    },
  ): Promise<{
    allowedEndpoints: AllowedEndpointTypeEntry[];
    legacyEndpoints: boolean;
  }> {
    const { namespaceName, componentTypeName } = request;
    const res =
      request.componentTypeKind === 'ClusterComponentType'
        ? await client.GET('/api/v1/clustercomponenttypes/{cctName}', {
            params: { path: { cctName: componentTypeName } },
          })
        : await client.GET(
            '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}',
            { params: { path: { namespaceName, ctName: componentTypeName } } },
          );
    assertApiResponse(
      res,
      `fetch ${request.componentTypeKind} ${componentTypeName}`,
    );
    const componentType = res.data!;
    return {
      allowedEndpoints: (componentType.spec?.allowedEndpoints ??
        []) as AllowedEndpointTypeEntry[],
      legacyEndpoints: isLegacyEndpointsComponentType(
        componentType.metadata?.annotations,
      ),
    };
  }

  /**
   * Returns drafts of a release line's Endpoints: the generator's copies of
   * the component's main-line Endpoints for the line, less those the line
   * already has. Nothing is created: the line's configure page lets the user
   * adjust each draft, such as its parameters, and creates the ones kept
   * through createComponentEndpoint.
   */
  async fetchReleaseLineEndpointDrafts(
    request: ComponentRef & { releaseLine: string; autoDeploy: boolean },
    token?: string,
  ): Promise<ComponentEndpointInput[]> {
    const releaseLine = toStoredReleaseLine(request.releaseLine);
    if (!releaseLine) {
      throw new InputError('releaseLine must name a release line, not main');
    }
    const client = this.client(token);
    const [main, line] = await Promise.all([
      listComponentEndpoints(client, { ...request, releaseLine: undefined }),
      listComponentEndpoints(client, { ...request, releaseLine }),
    ]);
    const existing = new Set(line.map(ep => ep.metadata.name));
    return releaseLineEndpointInputs(main.map(toComponentEndpointSummary), {
      componentName: request.componentName,
      projectName: request.projectName,
      releaseLine,
      autoDeploy: request.autoDeploy,
    }).filter(draft => !existing.has(draft.name));
  }

  /**
   * Creates an Endpoint for one of a component's workload endpoints, on its
   * main line or on one of its release lines, owned by the component and the
   * line. When the plain name is taken, the EndpointType is appended, as for
   * a workload endpoint exposed through more than one type.
   */
  async createComponentEndpoint(
    request: ComponentRef & {
      workloadEndpoint: string;
      typeKind: EndpointTypeKind;
      typeName: string;
      visibility: string[];
      parameters?: Record<string, unknown>;
      autoDeploy: boolean;
    },
    token?: string,
  ): Promise<{ name: string }> {
    if (request.visibility.length === 0) {
      throw new InputError('An Endpoint needs at least one visibility');
    }
    const client = this.client(token);
    const releaseLine = toStoredReleaseLine(request.releaseLine);
    const names = [
      componentEndpointName(
        request.componentName,
        request.workloadEndpoint,
        undefined,
        releaseLine,
      ),
      componentEndpointName(
        request.componentName,
        request.workloadEndpoint,
        request.typeName,
        releaseLine,
      ),
    ];
    for (const [i, name] of names.entries()) {
      const { error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/endpoints',
        {
          params: { path: { namespaceName: request.namespaceName } },
          body: buildComponentEndpoint({
            ...request,
            releaseLine,
            name,
          }) as any,
        },
      );
      if (response.status === 409 && i < names.length - 1) {
        continue;
      }
      assertApiResponse(
        { data: undefined, error, response },
        'create component endpoint',
      );
      this.logger.info(
        `Created Endpoint ${name} (${request.typeKind} ${
          request.typeName
        }) for workload endpoint ${request.workloadEndpoint} of ${lineSubject(
          request,
        )}`,
      );
      return { name };
    }
    // Unreachable: the last attempt either returns or throws.
    throw new Error('create component endpoint: no name left to try');
  }

  /**
   * Updates the visibility and parameters of one of a component's own
   * Endpoints, and points its backends at the renamed workload endpoint when
   * `workloadEndpoint` differs from the one it routes to. The type and
   * project are immutable. Refuses Endpoints the component's line doesn't
   * own.
   */
  async updateComponentEndpoint(
    request: ComponentRef & {
      endpointName: string;
      visibility: string[];
      parameters?: Record<string, unknown>;
      workloadEndpoint?: string;
    },
    token?: string,
  ): Promise<ComponentEndpointSummary> {
    if (request.visibility.length === 0) {
      throw new InputError(
        'An Endpoint needs at least one visibility; delete it instead',
      );
    }
    const client = this.client(token);
    const endpoint = await this.getManagedEndpoint(client, request);
    const spec = endpoint.spec;
    const current = toComponentEndpointSummary(endpoint);
    const renameTo =
      request.workloadEndpoint &&
      request.workloadEndpoint !== current.workloadEndpoint
        ? request.workloadEndpoint
        : undefined;

    // Parameters are replaced as a whole, so a field cleared in the form is
    // dropped rather than kept from the old spec.
    const { parameters: _replaced, ...rest } = spec;
    const body = {
      metadata: endpoint.metadata,
      spec: {
        ...rest,
        visibility: request.visibility as typeof spec.visibility,
        ...(request.parameters &&
          Object.keys(request.parameters).length > 0 && {
            parameters: request.parameters,
          }),
        ...(renameTo && {
          backendRefs: spec.backendRefs.map(ref =>
            ref.component?.endpoint === current.workloadEndpoint
              ? { ...ref, component: { ...ref.component, endpoint: renameTo } }
              : ref,
          ),
        }),
      },
    };

    const { data, error, response } = await client.PUT(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            endpointName: request.endpointName,
          },
        },
        body: body as any,
      },
    );
    assertApiResponse({ data, error, response }, 'update component endpoint');
    return toComponentEndpointSummary(data!);
  }

  /**
   * Deletes one of a component's own Endpoints. The Endpoint controller
   * removes its bindings, and so its routes, first. Refuses Endpoints the
   * component's line doesn't own.
   */
  async deleteComponentEndpoint(
    request: ComponentRef & { endpointName: string },
    token?: string,
  ): Promise<{ success: true }> {
    const client = this.client(token);
    await this.getManagedEndpoint(client, request);
    const { error, response } = await client.DELETE(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            endpointName: request.endpointName,
          },
        },
      },
    );
    assertApiResponse(
      { data: undefined, error, response },
      'delete component endpoint',
    );
    return { success: true };
  }

  /**
   * Adds a backend to an Endpoint, routing part of its traffic to a
   * component's workload endpoint, on its main line or on one of its release
   * lines. The API widens ownership to cover the new backend: an Endpoint a
   * release line owns moves to its component when the backend is on another
   * line, and one a component owns moves to its project when the backend is
   * on another component.
   */
  async addEndpointBackend(
    request: EndpointRef & {
      component: string;
      workloadEndpoint: string;
      /** The component's release line; undefined for its main line. */
      releaseLine?: string;
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
              ref.component?.endpoint === request.workloadEndpoint &&
              isSameReleaseLine(
                ref.component?.releaseLine,
                request.releaseLine,
              ),
          )
        ) {
          const line = request.releaseLine
            ? ` on line ${request.releaseLine}`
            : '';
          throw new InputError(
            `Endpoint ${request.endpointName} already routes to ${request.component}/${request.workloadEndpoint}${line}`,
          );
        }
        backendName = deriveEndpointBackendName(
          request.component,
          request.workloadEndpoint,
          refs.map(ref => ref.name),
          request.releaseLine,
        );
        return [
          ...refs,
          {
            name: backendName,
            kind: 'Component',
            component: {
              name: request.component,
              endpoint: request.workloadEndpoint,
              ...(request.releaseLine && {
                releaseLine: request.releaseLine,
              }),
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

  private async getManagedEndpoint(
    client: ReturnType<EndpointInfoService['client']>,
    request: ComponentRef & { endpointName: string },
  ) {
    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
      {
        params: {
          path: {
            namespaceName: request.namespaceName,
            endpointName: request.endpointName,
          },
        },
      },
    );
    assertApiResponse({ data, error, response }, 'fetch endpoint');
    const endpoint = data!;
    const owner = endpoint.spec?.owner;
    if (
      !endpoint.spec ||
      owner?.projectName !== request.projectName ||
      endpointManagingComponent(owner) !== request.componentName
    ) {
      throw new NotAllowedError(
        `Endpoint ${request.endpointName} is not owned by component ${request.componentName}; change it from its project instead`,
      );
    }
    const line = endpointManagingReleaseLine(owner);
    if (line !== (toStoredReleaseLine(request.releaseLine) ?? '')) {
      // The component's Endpoint of another line: refused, so one line's page
      // never rewrites another line's Endpoint.
      throw new NotAllowedError(
        `Endpoint ${request.endpointName} belongs to ${lineSubject({
          ...request,
          releaseLine: line,
        })}, not ${lineSubject(request)}; change it from there instead`,
      );
    }
    return { ...endpoint, spec: endpoint.spec };
  }
}
