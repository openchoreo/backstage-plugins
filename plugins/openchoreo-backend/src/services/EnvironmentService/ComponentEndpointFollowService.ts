import { LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import {
  assertApiResponse,
  createOpenChoreoApiClient,
  fetchAllPages,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  emptyEndpointFollowResult,
  planEndpointFollow,
  type EndpointFollowAction,
  type EndpointFollowResult,
  type FollowingEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  listComponentEndpoints,
  type ComponentRef,
} from '../EndpointService/componentEndpoints';

type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;
type Endpoint = OpenChoreoComponents['schemas']['Endpoint'];

/** Writes the binding that pins an Endpoint to an environment. */
export interface EndpointBindingWriter {
  /** Creates or updates the binding, keeping its environment overrides. */
  updateEndpointReleaseBinding(
    request: {
      endpointName: string;
      projectName: string;
      namespaceName: string;
      environment: string;
      releaseName: string;
    },
    token?: string,
  ): Promise<unknown>;
  /** Deletes the binding; NotFoundError when there is none. */
  deleteEndpointReleaseBinding(
    request: {
      endpointName: string;
      projectName: string;
      namespaceName: string;
      environment: string;
    },
    token?: string,
  ): Promise<unknown>;
}

export interface ComponentEndpointFollowOptions {
  /** How long to wait for an Endpoint's first release (default 5s). */
  releaseWaitMs?: number;
  /** How often to look for it meanwhile (default 1s). */
  pollMs?: number;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Takes a component's Endpoints with it when the component is deployed,
 * promoted, redeployed or undeployed, following the rules in
 * `planEndpointFollow`. Runs after the component's own binding has changed:
 * an Endpoint that can't follow is reported, never undoing the component's
 * change, and repeating the action repeats every step safely.
 */
export class ComponentEndpointFollowService {
  private readonly releaseWaitMs: number;
  private readonly pollMs: number;

  constructor(
    private readonly logger: LoggerService,
    private readonly baseUrl: string,
    private readonly bindings: EndpointBindingWriter,
    options: ComponentEndpointFollowOptions = {},
  ) {
    this.releaseWaitMs = options.releaseWaitMs ?? 5000;
    this.pollMs = options.pollMs ?? 1000;
  }

  private client(token?: string): OpenChoreoApiClient {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  /** The release an Endpoint's binding in an environment pins, if any. */
  private async boundRelease(
    client: OpenChoreoApiClient,
    request: ComponentRef,
    endpointName: string,
    environment: string,
  ): Promise<string | undefined> {
    const bindings = await fetchAllPages(cursor =>
      client
        .GET('/api/v1/namespaces/{namespaceName}/endpointreleasebindings', {
          params: {
            path: { namespaceName: request.namespaceName },
            query: { endpoint: endpointName, limit: 100, cursor },
          },
        })
        .then(res => {
          assertApiResponse(res, 'fetch endpoint release bindings');
          return res.data;
        }),
    );
    const env = environment.toLowerCase();
    return bindings.find(
      b =>
        b.spec?.owner?.projectName === request.projectName &&
        b.spec?.environment?.toLowerCase() === env,
    )?.spec?.endpointRelease;
  }

  /**
   * Binds the Endpoints the component's line owns in the environment the
   * component was just deployed, promoted or redeployed to.
   */
  async follow(
    request: ComponentRef & {
      environment: string;
      action: EndpointFollowAction;
      /** Where a promotion came from; the Endpoints' releases come from there. */
      sourceEnvironment?: string;
    },
    token?: string,
  ): Promise<EndpointFollowResult> {
    const client = this.client(token);
    let endpoints = await listComponentEndpoints(client, request);
    const result = emptyEndpointFollowResult();
    if (endpoints.length === 0) return result;

    const sourceReleases = new Map<string, string>();
    if (request.action === 'promote' && request.sourceEnvironment) {
      for (const endpoint of endpoints) {
        const release = await this.boundRelease(
          client,
          request,
          endpoint.metadata.name,
          request.sourceEnvironment,
        );
        if (release) sourceReleases.set(endpoint.metadata.name, release);
      }
    }

    // An Endpoint created just before the deploy may not have a release
    // yet: the controller cuts it asynchronously. Wait for it briefly.
    const waitsForRelease = (endpoint: Endpoint) =>
      !(request.action === 'deploy' && endpoint.spec?.autoDeploy) &&
      !sourceReleases.has(endpoint.metadata.name) &&
      !endpoint.status?.latestRelease?.name;
    const deadline = Date.now() + this.releaseWaitMs;
    while (endpoints.some(waitsForRelease) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, this.pollMs));
      endpoints = await listComponentEndpoints(client, request);
    }

    const following: FollowingEndpoint[] = endpoints.map(endpoint => ({
      name: endpoint.metadata.name,
      autoDeploy: endpoint.spec?.autoDeploy ?? false,
      latestRelease: endpoint.status?.latestRelease?.name,
      sourceRelease: sourceReleases.get(endpoint.metadata.name),
    }));
    for (const step of planEndpointFollow(request.action, following)) {
      if (step.kind === 'skip') {
        result.skipped.push(step.endpoint);
        continue;
      }
      if (step.kind === 'unreleased') {
        result.failed.push({
          endpoint: step.endpoint,
          reason: 'it has no release yet',
        });
        continue;
      }
      try {
        await this.bindings.updateEndpointReleaseBinding(
          {
            endpointName: step.endpoint,
            projectName: request.projectName,
            namespaceName: request.namespaceName,
            environment: request.environment,
            releaseName: step.releaseName,
          },
          token,
        );
        result.bound.push({
          endpoint: step.endpoint,
          releaseName: step.releaseName,
        });
      } catch (error) {
        result.failed.push({
          endpoint: step.endpoint,
          reason: reasonOf(error),
        });
      }
    }
    this.logResult('followed', request, result);
    return result;
  }

  /**
   * Deletes the bindings of the Endpoints the component's line owns in an
   * environment the component was undeployed or removed from, so their
   * routes don't point at a workload that's gone. An Endpoint not bound
   * there needs nothing.
   */
  async remove(
    request: ComponentRef & { environment: string },
    token?: string,
  ): Promise<EndpointFollowResult> {
    const endpoints = await listComponentEndpoints(this.client(token), request);
    const result = emptyEndpointFollowResult();
    for (const endpoint of endpoints) {
      const endpointName = endpoint.metadata.name;
      try {
        await this.bindings.deleteEndpointReleaseBinding(
          {
            endpointName,
            projectName: request.projectName,
            namespaceName: request.namespaceName,
            environment: request.environment,
          },
          token,
        );
        result.removed.push(endpointName);
      } catch (error) {
        if (error instanceof NotFoundError) continue;
        result.failed.push({ endpoint: endpointName, reason: reasonOf(error) });
      }
    }
    this.logResult('removed', request, result);
    return result;
  }

  /** The environment a component's ReleaseBinding is for. */
  async bindingEnvironment(
    namespaceName: string,
    bindingName: string,
    token?: string,
  ): Promise<string | undefined> {
    const { data, error, response } = await this.client(token).GET(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      {
        params: { path: { namespaceName, releaseBindingName: bindingName } },
      },
    );
    assertApiResponse({ data, error, response }, 'fetch release binding');
    return data?.spec?.environment;
  }

  private logResult(
    what: string,
    request: ComponentRef & { environment: string },
    result: EndpointFollowResult,
  ) {
    const line = request.releaseLine ? ` (line ${request.releaseLine})` : '';
    this.logger.info(
      `Endpoints of ${request.componentName}${line} ${what} in ${request.environment}: bound ${result.bound.length}, removed ${result.removed.length}, skipped ${result.skipped.length}, failed ${result.failed.length}`,
    );
    for (const failure of result.failed) {
      this.logger.warn(
        `Endpoint ${failure.endpoint} of ${request.componentName} didn't follow to ${request.environment}: ${failure.reason}`,
      );
    }
  }
}
