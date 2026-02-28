import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Expand } from '@backstage/types';
import {
  createOpenChoreoAIRCAAgentApiClient,
  AIRCAAgentComponents,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';

type ChatRequest = AIRCAAgentComponents['schemas']['ChatRequest'];
type RCAReportsResponse = AIRCAAgentComponents['schemas']['RCAReportsResponse'];
type RCAReportDetailed = AIRCAAgentComponents['schemas']['RCAReportDetailed'];

export class RCAAgentService {
  private readonly logger: LoggerService;
  private readonly resolver: ObservabilityUrlResolver;

  static create(logger: LoggerService, baseUrl: string): RCAAgentService {
    return new RCAAgentService(logger, baseUrl);
  }

  private constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  /**
   * Resolves the RCA agent URL for a given namespace and environment.
   */
  async resolveRCAAgentUrl(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<string> {
    if (!environmentName) {
      throw new Error('Environment is required to resolve RCA agent URL');
    }

    const { rcaAgentUrl } = await this.resolver.resolveForEnvironment(
      namespaceName,
      environmentName,
      userToken,
    );

    if (!rcaAgentUrl) {
      throw new Error(
        `RCA service is not configured for namespace ${namespaceName}, environment ${environmentName}`,
      );
    }

    this.logger.debug(
      `Resolved RCA agent URL: ${rcaAgentUrl} for namespace ${namespaceName}, environment ${environmentName}`,
    );

    return rcaAgentUrl;
  }

  /**
   * Creates an RCA agent client for the given namespace and environment.
   *
   * @param namespaceName - The namespace name
   * @param environmentName - The environment name
   * @param userToken - Optional user token for authentication
   * @returns The configured RCA agent client
   */
  async createClient(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ) {
    const rcaAgentUrl = await this.resolveRCAAgentUrl(
      namespaceName,
      environmentName,
      userToken,
    );

    return createOpenChoreoAIRCAAgentApiClient({
      baseUrl: rcaAgentUrl,
      token: userToken,
      logger: this.logger,
    });
  }

  /**
   * Streams a chat request to the RCA agent and returns the response.
   * This method handles the streaming response from the RCA agent.
   *
   * @param namespaceName - The namespace name
   * @param environmentName - The environment name
   * @param request - The chat request body
   * @param userToken - Optional user token for authentication
   * @returns The fetch Response object for streaming
   */
  async streamChat(
    namespaceName: string,
    environmentName: string,
    request: ChatRequest,
    userToken?: string,
  ): Promise<Response> {
    const rcaAgentUrl = await this.resolveRCAAgentUrl(
      namespaceName,
      environmentName,
      userToken,
    );

    this.logger.debug(
      `Sending chat request to RCA agent at ${rcaAgentUrl}/api/v1/agent/chat`,
    );

    const response = await fetch(`${rcaAgentUrl}/api/v1/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
      body: JSON.stringify(request),
    });

    return response;
  }

  /**
   * Fetches RCA reports for a specific project from the RCA Agent service.
   *
   * @param namespaceName - The namespace name
   * @param environmentName - The environment name
   * @param projectId - The project UUID
   * @param environmentId - The environment UUID
   * @param componentUids - Array of component UIDs to filter reports (optional)
   * @param options - Parameters for filtering reports
   * @param options.startTime - The start time of the reports (required)
   * @param options.endTime - The end time of the reports (required)
   * @param options.status - Filter by report status (pending/completed/failed) (optional)
   * @param options.limit - The maximum number of reports to return (optional)
   * @param userToken - Optional user token for authentication
   * @returns Promise with RCA reports data
   */
  async fetchRCAReportsByProject(
    namespaceName: string,
    environmentName: string,
    projectId: string,
    environmentId: string,
    componentUids: string[],
    options: {
      startTime: string;
      endTime: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
    userToken?: string,
  ): Promise<RCAReportsResponse> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching RCA reports for project ${projectId} in environment ${environmentName}`,
      );

      const client = await this.createClient(
        namespaceName,
        environmentName,
        userToken,
      );

      this.logger.debug(
        `Sending RCA reports request to /api/v1/rca-reports/projects/${projectId}`,
      );

      const { data, error, response } = await client.GET(
        '/api/v1/rca-reports/projects/{projectId}',
        {
          params: {
            path: { projectId },
            query: {
              environmentUid: environmentId,
              startTime: options.startTime,
              endTime: options.endTime,
              componentUids:
                componentUids.length > 0 ? componentUids : undefined,
              status: options.status,
              limit: options.limit,
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = error
          ? JSON.stringify(error)
          : `HTTP ${response.status} ${response.statusText}`;
        this.logger.error(
          `Failed to fetch RCA reports for project ${projectId}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch RCA reports: ${errorMessage}`);
      }

      this.logger.debug(
        `Successfully fetched RCA reports for project ${projectId}: ${
          data?.reports?.length || 0
        } reports`,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `RCA reports fetch completed for project ${projectId} (${totalTime}ms)`,
      );

      return {
        reports: data?.reports || [],
        totalCount: data?.totalCount || 0,
        tookMs: data?.tookMs || 0,
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching RCA reports for project ${projectId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches a single RCA report by alert ID from the RCA Agent service.
   *
   * @param namespaceName - The namespace name
   * @param environmentName - The environment name
   * @param alertId - The ID of the alert
   * @param options - Optional parameters
   * @param options.version - Specific version number of the report to retrieve
   * @param userToken - Optional user token for authentication
   * @returns Promise with RCA report details
   */
  async fetchRCAReportByAlert(
    namespaceName: string,
    environmentName: string,
    alertId: string,
    options?: {
      version?: number;
    },
    userToken?: string,
  ): Promise<RCAReportDetailed> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching RCA report for alert ${alertId} in environment ${environmentName}`,
      );

      const client = await this.createClient(
        namespaceName,
        environmentName,
        userToken,
      );

      this.logger.debug(
        `Sending RCA report request to /api/v1/rca-reports/alerts/${alertId}${
          options?.version ? `?version=${options.version}` : ''
        }`,
      );

      const { data, error, response } = await client.GET(
        '/api/v1/rca-reports/alerts/{alertId}',
        {
          params: {
            path: { alertId },
            query: options?.version ? { version: options.version } : {},
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = error
          ? JSON.stringify(error)
          : `HTTP ${response.status} ${response.statusText}`;
        this.logger.error(
          `Failed to fetch RCA report for alert ${alertId}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch RCA report: ${errorMessage}`);
      }

      this.logger.debug(`Successfully fetched RCA report for alert ${alertId}`);

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `RCA report fetch completed for alert ${alertId} (${totalTime}ms)`,
      );

      return data;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching RCA report for alert ${alertId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}

export const rcaAgentServiceRef = createServiceRef<Expand<RCAAgentService>>({
  id: 'openchoreo.rca-agent',
  defaultFactory: async service =>
    createServiceFactory({
      service,
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async factory(deps) {
        const baseUrl =
          deps.config.getOptionalString('openchoreo.baseUrl') ||
          'http://localhost:8080';
        return RCAAgentService.create(deps.logger, baseUrl);
      },
    }),
});
