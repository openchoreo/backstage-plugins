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
import { Environment } from '../types';

/**
 * Error thrown when observability is not configured for a component
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(componentId: string) {
    super(`Observability is not configured for component ${componentId}`);
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
   * Resolves both the observer and RCA agent URLs for a given namespace and environment.
   * Used by the frontend to make direct calls to observer/RCA APIs.
   */
  async resolveUrls(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<{ observerUrl?: string; rcaAgentUrl?: string }> {
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
   * Fetches environments for observability filtering purposes.
   *
   * @param namespaceName - The namespace name
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   */
  async fetchEnvironmentsByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        token: userToken,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/environments',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch environments for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data?.items) {
        this.logger.warn(
          `No environments found for namespace ${namespaceName}`,
        );
        return [];
      }

      const environments: Environment[] = data.items.map((item: any) => ({
        uid: item.metadata?.uid ?? '',
        name: item.metadata?.name ?? '',
        namespace: item.metadata?.namespace ?? '',
        isProduction: item.spec?.isProduction ?? false,
        dataPlaneRef: item.spec?.dataPlaneRef,
        createdAt: item.metadata?.creationTimestamp ?? '',
      }));

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed: ${environments.length} environments found (${totalTime}ms)`,
      );

      return environments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environments for namespace ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
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
