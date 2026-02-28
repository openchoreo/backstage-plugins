import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  fetchAllPages,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunResponse } from '@openchoreo/backstage-plugin-common';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { transformComponentWorkflowRun } from '../transformers';
import { RuntimeLogsResponse } from '../../types';

type ModelsBuild = ComponentWorkflowRunResponse;

export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Build logs are not available for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

export class BuildInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private readonly resolver: ObservabilityUrlResolver;
  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  async fetchBuilds(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching component workflow runs for component: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const items = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/workflowruns', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch component workflow runs: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      // Filter by component label and transform
      const builds = items
        .filter(
          (run: any) =>
            run.metadata?.labels?.[CHOREO_LABELS.WORKFLOW_COMPONENT] ===
            componentName,
        )
        .map(transformComponentWorkflowRun);

      this.logger.debug(
        `Successfully fetched ${builds.length} component workflow runs for component: ${componentName}`,
      );
      return builds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflow runs for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async getWorkflowRun(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    token?: string,
  ): Promise<any> {
    this.logger.debug(
      `Fetching workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}',
        {
          params: {
            path: { namespaceName, runName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run: ${response.status} ${response.statusText}`,
        );
      }

      const runLabels = (data as any)?.metadata?.labels ?? {};
      if (
        runLabels[CHOREO_LABELS.WORKFLOW_COMPONENT] !== componentName ||
        runLabels[CHOREO_LABELS.WORKFLOW_PROJECT] !== projectName
      ) {
        throw new Error(
          `Workflow run ${runName} does not belong to component ${componentName} in project ${projectName}`,
        );
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);
      return transformComponentWorkflowRun(data);
    } catch (error) {
      this.logger.error(`Failed to fetch workflow run ${runName}: ${error}`);
      throw error;
    }
  }

  async triggerBuild(
    namespaceName: string,
    projectName: string,
    componentName: string,
    commit?: string,
    token?: string,
  ): Promise<ModelsBuild> {
    this.logger.info(
      `Triggering component workflow for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}${
        commit ? ` with commit: ${commit}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch component to resolve its configured workflow name
      const { data: compData, error: compError } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        { params: { path: { namespaceName, componentName } } },
      );
      if (compError || !compData) {
        throw new Error(
          `Failed to fetch component ${componentName} to determine workflow name`,
        );
      }
      const workflowName = (compData as any)?.spec?.workflow?.name;
      if (!workflowName) {
        throw new Error(
          `Component ${componentName} has no workflow configured`,
        );
      }

      const parameters: Record<string, unknown> = {};
      if (commit) parameters.commit = commit;

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/workflowruns',
        {
          params: { path: { namespaceName } },
          body: {
            metadata: {
              name: `${componentName}-${Date.now()}`,
              labels: {
                [CHOREO_LABELS.WORKFLOW_COMPONENT]: componentName,
                [CHOREO_LABELS.WORKFLOW_PROJECT]: projectName,
              },
            },
            spec: { workflow: { name: workflowName, parameters } },
          } as any,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create component workflow run: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully triggered component workflow for component: ${componentName}`,
      );
      return transformComponentWorkflowRun(data);
    } catch (error) {
      this.logger.error(
        `Failed to trigger component workflow for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchBuildLogs(
    namespaceName: string,
    projectName: string,
    componentName: string,
    buildId: string,
    limit?: number,
    sortOrder?: 'asc' | 'desc',
    token?: string,
  ): Promise<RuntimeLogsResponse> {
    this.logger.debug(
      `Fetching build logs for component: ${componentName}, build: ${buildId}`,
    );

    try {
      const { observerUrl } = await this.resolver.resolveForBuild(
        namespaceName,
        projectName,
        token,
      );

      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(componentName);
      }
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      this.logger.debug(
        `Sending build logs request for component ${componentName} with build: ${buildId}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/logs/build/{buildId}',
        {
          params: {
            path: { buildId },
          },
          body: {
            startTime: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 30 days ago
            endTime: new Date().toISOString(),
            limit: limit || 1000, // Default to 1000 until pagination is implemented
            sortOrder: sortOrder || 'asc',
            componentName,
            projectName,
            namespaceName,
          },
        },
      );

      if (error || !response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to fetch build logs for component ${componentName}: ${response.status} ${response.statusText}`,
          { error: errorText },
        );
        throw new Error(
          `Failed to fetch build logs: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched ${
          data.logs?.length || 0
        } build logs for component ${componentName}`,
      );

      return {
        logs: data.logs || [],
        totalCount: data.totalCount || 0,
        tookMs: data.tookMs || 0,
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${componentName}`,
        );
        throw error;
      }

      this.logger.error(
        `Error fetching build logs for component ${componentName}:`,
        error as Error,
      );
      throw error;
    }
  }
}
