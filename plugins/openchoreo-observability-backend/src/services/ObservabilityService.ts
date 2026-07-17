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
 * Extracts the environment name from a pipeline `sourceEnvironmentRef`, which
 * may be a plain string (old API) or an object `{ kind, name }` (new API).
 */
function getSourceEnvName(ref: unknown): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && 'name' in ref) {
    return (ref as { name: string }).name;
  }
  return '';
}

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
   * When `projectName` is supplied, the result is restricted to the
   * environments defined by that project's deployment pipeline (mirroring the
   * Deploy tab). A project whose pipeline is missing, unresolvable, or defines
   * no promotion paths has no deployable environments, so an empty list is
   * returned and observability pages show their "no environments" state
   * instead of every environment in the namespace. Without `projectName` the
   * full namespace list is returned.
   *
   * @param namespaceName - The namespace name
   * @param projectName - Optional project whose deployment pipeline scopes the result
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   */
  async fetchEnvironmentsByNamespace(
    namespaceName: string,
    projectName?: string,
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

      let result = environments;
      if (projectName) {
        const pipelineEnvNames = await this.fetchPipelineEnvironmentNames(
          client,
          namespaceName,
          projectName,
        );
        // No resolvable pipeline / no promotion paths → no deployable envs.
        result = pipelineEnvNames
          ? environments.filter(env =>
              pipelineEnvNames.has(env.name.toLowerCase()),
            )
          : [];
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed: ${result.length} environments found (${totalTime}ms)`,
      );

      return result;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environments for namespace ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Resolves the set of environment names (lower-cased) referenced by a
   * project's deployment pipeline promotion paths. Returns `null` when the
   * pipeline cannot be resolved (the project has no `deploymentPipelineRef`,
   * the pipeline fetch fails) or when it defines no promotion paths — all of
   * which mean the project has no deployable environments.
   */
  private async fetchPipelineEnvironmentNames(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    namespaceName: string,
    projectName: string,
  ): Promise<Set<string> | null> {
    const {
      data: project,
      error: projectError,
      response: projectResponse,
    } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
      {
        params: {
          path: { namespaceName, projectName },
        },
      },
    );

    const pipelineName = project?.spec?.deploymentPipelineRef?.name;
    if (projectError || !projectResponse.ok || !pipelineName) {
      return null;
    }

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
      {
        params: {
          path: { namespaceName, deploymentPipelineName: pipelineName },
        },
      },
    );

    if (error || !response.ok) {
      return null;
    }

    const promotionPaths = data?.spec?.promotionPaths ?? [];
    if (promotionPaths.length === 0) {
      return null;
    }

    const envNames = new Set<string>();
    for (const path of promotionPaths) {
      const source = getSourceEnvName(path.sourceEnvironmentRef);
      if (source) {
        envNames.add(source.toLowerCase());
      }
      for (const target of path.targetEnvironmentRefs ?? []) {
        if (target?.name) {
          envNames.add(target.name.toLowerCase());
        }
      }
    }

    return envNames.size > 0 ? envNames : null;
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
