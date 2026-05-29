import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Expand } from '@backstage/types';
import {
  createOpenChoreoApiClient,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';

/**
 * Error thrown when observability is not configured for a component
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Observability is not configured for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

export class ObservabilityService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly resolver: ObservabilityUrlResolver;

  static create(logger: LoggerService, baseUrl: string): ObservabilityService {
    return new ObservabilityService(logger, baseUrl);
  }

  private constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  /**
   * Resolves the observer, RCA agent, and FinOps agent URLs for a given namespace and environment.
   * Used by the frontend to make direct calls to observer/RCA/FinOps APIs.
   */
  async resolveUrls(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<{
    observerUrl?: string;
    rcaAgentUrl?: string;
    finopsAgentUrl?: string;
  }> {
    return this.resolver.resolveForEnvironment(
      namespaceName,
      environmentName,
      userToken,
    );
  }

  async getReleaseBinding(
    namespaceName: string,
    bindingName: string,
    userToken?: string,
  ) {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      logger: this.logger,
      token: userToken,
    });
    return client.GET(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      { params: { path: { namespaceName, releaseBindingName: bindingName } } },
    );
  }

  async updateReleaseBinding(
    namespaceName: string,
    bindingName: string,
    body: any,
    userToken?: string,
  ) {
    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      logger: this.logger,
      token: userToken,
    });
    return client.PUT(
      '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}',
      {
        params: { path: { namespaceName, releaseBindingName: bindingName } },
        body,
      },
    );
  }

  /**
   * Fetches the `openchoreo.dev/networkpolicyprovider` annotation from a
   * DataPlane or ClusterDataPlane CR.
   */
  async fetchDataPlaneNetPolProvider(
    namespaceName: string,
    dpKind: string,
    dpName: string,
    userToken?: string,
  ): Promise<string | undefined> {
    if (dpKind !== 'DataPlane' && dpKind !== 'ClusterDataPlane') {
      this.logger.warn(
        `fetchDataPlaneNetPolProvider: invalid dpKind '${dpKind}', expected 'DataPlane' or 'ClusterDataPlane'`,
      );
      return undefined;
    }

    const client = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      logger: this.logger,
      token: userToken,
    });

    try {
      let annotations: Record<string, string> | undefined;
      if (dpKind === 'ClusterDataPlane') {
        const { data } = await client.GET(
          '/api/v1/clusterdataplanes/{cdpName}',
          { params: { path: { cdpName: dpName } } },
        );
        annotations = data?.metadata?.annotations;
      } else {
        const { data } = await client.GET(
          '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
          { params: { path: { namespaceName, dpName } } },
        );
        annotations = data?.metadata?.annotations;
      }
      return annotations?.['openchoreo.dev/networkpolicyprovider'];
    } catch (err) {
      this.logger.error(
        `fetchDataPlaneNetPolProvider: failed to fetch annotation for ${dpKind}/${dpName} in namespace ${namespaceName}`,
        err as Error,
      );
      return undefined;
    }
  }
}

export const observabilityServiceRef = createServiceRef<
  Expand<ObservabilityService>
>({
  id: 'openchoreo.observability',
  defaultFactory: async service =>
    createServiceFactory({
      service,
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async factory(deps) {
        // Read configuration from app-config.yaml
        const baseUrl =
          deps.config.getOptionalString('openchoreo.baseUrl') ||
          'http://localhost:8080';
        return ObservabilityService.create(deps.logger, baseUrl);
      },
    }),
});
