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
   * When `projectName` is provided, the result is restricted to environments
   * that appear in the project's deployment pipeline (as either a source or
   * target of any promotion path). Without it, all environments in the
   * namespace are returned.
   *
   * @param namespaceName - The namespace name
   * @param projectName - Optional project name to filter environments by the project's deployment pipeline
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
        `Starting environment fetch for namespace: ${namespaceName}${
          projectName ? `, project: ${projectName}` : ''
        }`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        token: userToken,
      });

      // Resolve the set of environment names allowed by the project's
      // deployment pipeline, if a project is specified. A null result means
      // no filter should be applied (project/pipeline lookup failed or no
      // project context was given).
      const allowedEnvNames = projectName
        ? await this.resolveDeploymentPipelineEnvironments(
            client,
            namespaceName,
            projectName,
          )
        : null;

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

      let environments: Environment[] = data.items.map((item: any) => ({
        uid: item.metadata?.uid ?? '',
        name: item.metadata?.name ?? '',
        namespace: item.metadata?.namespace ?? '',
        displayName:
          item.metadata?.annotations?.['openchoreo.dev/display-name'],
        isProduction: item.spec?.isProduction ?? false,
        dataPlaneRef: item.spec?.dataPlaneRef,
        createdAt: item.metadata?.creationTimestamp ?? '',
      }));

      if (allowedEnvNames) {
        environments = environments.filter(env =>
          allowedEnvNames.has(env.name),
        );
      }

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

  /**
   * Resolves the set of environment names referenced by the project's
   * deployment pipeline. Returns null when the lookup cannot be completed
   * (project not found, no pipeline ref, etc.) so the caller can decide
   * whether to skip filtering.
   */
  private async resolveDeploymentPipelineEnvironments(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    namespaceName: string,
    projectName: string,
  ): Promise<Set<string> | null> {
    const projectResult = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
      { params: { path: { namespaceName, projectName } } },
    );
    if (
      projectResult.error ||
      !projectResult.response.ok ||
      !projectResult.data
    ) {
      this.logger.warn(
        `Failed to fetch project ${projectName} in namespace ${namespaceName} for environment filtering; returning unfiltered list`,
      );
      return null;
    }

    const pipelineName =
      projectResult.data.spec?.deploymentPipelineRef?.name;
    if (!pipelineName) {
      this.logger.warn(
        `Project ${projectName} has no deploymentPipelineRef; returning unfiltered environment list`,
      );
      return null;
    }

    const pipelineResult = await client.GET(
      '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
      {
        params: {
          path: { namespaceName, deploymentPipelineName: pipelineName },
        },
      },
    );
    if (
      pipelineResult.error ||
      !pipelineResult.response.ok ||
      !pipelineResult.data
    ) {
      this.logger.warn(
        `Failed to fetch deployment pipeline ${pipelineName} in namespace ${namespaceName}; returning unfiltered environment list`,
      );
      return null;
    }

    const allowed = new Set<string>();
    for (const path of pipelineResult.data.spec?.promotionPaths ?? []) {
      if (path.sourceEnvironmentRef?.name) {
        allowed.add(path.sourceEnvironmentRef.name);
      }
      for (const target of path.targetEnvironmentRefs ?? []) {
        if (target.name) {
          allowed.add(target.name);
        }
      }
    }
    return allowed;
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
