import { LoggerService } from '@backstage/backend-plugin-api';
import { RuntimeLogsService, RuntimeLogsResponse } from '../../types';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
} from '@openchoreo/openchoreo-client-node';

/**
 * Error thrown when observability is not configured for a component
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Runtime logs are not available for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

/**
 * Service for fetching runtime logs for components.
 * This service handles fetching runtime logs from the OpenChoreo API.
 */
export class RuntimeLogsInfoService implements RuntimeLogsService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly token?: string;

  public constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Fetches runtime logs for a specific component.
   * This method retrieves logs based on the provided filters including log levels,
   * time range, and pagination parameters.
   *
   * @param {Object} request - The request parameters
   * @param {string} request.componentId - ID of the component to fetch logs for
   * @param {string} request.environmentId - Environment ID to filter logs
   * @param {string[]} request.logLevels - Optional array of log levels to filter by
   * @param {string} request.startTime - Optional start time for log range
   * @param {string} request.endTime - Optional end time for log range
   * @param {number} request.limit - Optional limit for number of logs (default 50)
   * @returns {Promise<RuntimeLogsResponse>} Response containing logs array, total count, and timing
   * @throws {Error} When there's an error fetching data from the API
   */
  async fetchRuntimeLogs(
    request: {
      componentName: string;
      componentId: string;
      environmentName: string;
      environmentId: string;
      logLevels?: ('TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL')[];
      startTime?: string;
      endTime?: string;
      limit?: number;
    },
    orgName: string,
    projectName: string,
  ): Promise<RuntimeLogsResponse> {
    try {
      const {
        componentId,
        componentName,
        environmentId,
        environmentName,
        logLevels,
        startTime,
        endTime,
        limit = 50,
      } = request;

      this.logger.info(
        `Fetching runtime logs for component ${componentName} in environment ${environmentName}`,
      );

      // First, get the observer URL from the main API
      const mainClient = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const {
        data: urlData,
        error: urlError,
        response: urlResponse,
      } = await mainClient.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/observer-url',
        {
          params: {
            path: {
              orgName,
              projectName,
              componentName,
              environmentName,
            },
          },
        },
      );

      if (urlError || !urlResponse.ok) {
        throw new Error(
          `Failed to get observer URL: ${urlResponse.status} ${urlResponse.statusText}`,
        );
      }

      if (!urlData.success || !urlData.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
        );
      }

      const observerUrl = urlData.data.observerUrl;
      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(componentName);
      }

      // Now use the observability client with the resolved URL
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        this.token,
        this.logger,
      );

      this.logger.info(
        `Sending logs request for component ${componentId} with limit: ${limit}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/logs/component/{componentId}',
        {
          params: {
            path: { componentId },
          },
          body: {
            startTime:
              startTime || new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Default: 1 hour ago
            endTime: endTime || new Date().toISOString(), // Default: now
            environmentId,
            limit,
            sortOrder: 'desc',
            ...(logLevels && logLevels.length > 0 && { logLevels }),
          },
        },
      );

      if (error || !response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to fetch runtime logs for component ${componentId}: ${response.status} ${response.statusText}`,
          { error: errorText },
        );
        throw new Error(
          `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.info(
        `Successfully fetched ${
          data.logs?.length || 0
        } runtime logs for component ${componentId}`,
      );

      return {
        logs: data.logs || [],
        totalCount: data.totalCount || 0,
        tookMs: data.tookMs || 0,
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${request.componentId}`,
        );
        throw error;
      }

      this.logger.error(
        `Error fetching runtime logs for component ${request.componentId}:`,
        error as Error,
      );
      throw error;
    }
  }
}
