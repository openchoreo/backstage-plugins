import {
  assertApiResponse,
  fetchAllPages,
  type createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  endpointManagingComponent,
  endpointManagingReleaseLine,
  toStoredReleaseLine,
  type ComponentEndpointSummary,
} from '@openchoreo/backstage-plugin-common';

type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;
type Endpoint = OpenChoreoComponents['schemas']['Endpoint'];

/** Identifies a component, or one of its release lines. */
export interface ComponentRef {
  componentName: string;
  projectName: string;
  namespaceName: string;
  /**
   * The component's release line whose Endpoints are meant. Omitted or '' for
   * its main line.
   */
  releaseLine?: string;
}

/**
 * Lists the Endpoints one of a component's lines owns: main when
 * `request.releaseLine` is unset. These move between environments with the
 * component, and deleting the component (or the line) deletes them. An
 * Endpoint whose backends reach beyond the line or the component is owned by
 * the component or the project instead, as the API widens the owner on update.
 */
export async function listComponentEndpoints(
  client: OpenChoreoApiClient,
  request: ComponentRef,
): Promise<Endpoint[]> {
  const items = await fetchAllPages(cursor =>
    client
      .GET('/api/v1/namespaces/{namespaceName}/endpoints', {
        params: {
          path: { namespaceName: request.namespaceName },
          query: { project: request.projectName, limit: 100, cursor },
        },
      })
      .then(res => {
        assertApiResponse(res, 'fetch component endpoints');
        return res.data;
      }),
  );
  return items.filter(ep =>
    isManagedBy(ep, request.componentName, request.releaseLine),
  );
}

/**
 * Whether the component owns this Endpoint for the given line, main when
 * `releaseLine` is unset.
 */
export function isManagedBy(
  endpoint: Endpoint,
  componentName: string,
  releaseLine?: string,
): boolean {
  const owner = endpoint.spec?.owner;
  return (
    endpointManagingComponent(owner) === componentName &&
    endpointManagingReleaseLine(owner) ===
      (toStoredReleaseLine(releaseLine) ?? '')
  );
}

/**
 * What the component's configure page shows of one of its Endpoints. The
 * workload endpoint is the first one its backends route to: the one it was
 * created for, unless backends were added since.
 */
export function toComponentEndpointSummary(
  endpoint: Endpoint,
): ComponentEndpointSummary {
  const spec = endpoint.spec;
  const ready = endpoint.status?.conditions?.find(c => c.type === 'Ready');
  return {
    name: endpoint.metadata.name,
    releaseLine: endpointManagingReleaseLine(spec?.owner) ?? '',
    workloadEndpoint:
      spec?.backendRefs?.find(ref => ref.component?.endpoint)?.component
        ?.endpoint ?? '',
    typeKind:
      spec?.type?.kind === 'ClusterEndpointType'
        ? 'ClusterEndpointType'
        : 'EndpointType',
    typeName: spec?.type?.name ?? '',
    visibility: [...(spec?.visibility ?? [])],
    parameters: (spec?.parameters ?? {}) as Record<string, unknown>,
    autoDeploy: spec?.autoDeploy ?? false,
    ...(ready && {
      ready: {
        status: ready.status,
        reason: ready.reason,
        message: ready.message,
      },
    }),
    ...(endpoint.status?.latestRelease?.name && {
      latestRelease: endpoint.status.latestRelease.name,
    }),
  };
}
