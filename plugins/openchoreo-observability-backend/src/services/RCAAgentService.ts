import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Expand } from '@backstage/types';
import {
  createOpenChoreoApiClient,
  createOpenChoreoAIRCAAgentApiClient,
  AIRCAAgentComponents,
} from '@openchoreo/openchoreo-client-node';

type ChatRequest = AIRCAAgentComponents['schemas']['ChatRequest'];

export class RCAAgentService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  static create(logger: LoggerService, baseUrl: string): RCAAgentService {
    return new RCAAgentService(logger, baseUrl);
  }

  private constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Resolves the RCA agent URL for a given namespace and environment.
   *
   * @param namespaceName - The namespace name
   * @param environmentName - The environment name
   * @param userToken - Optional user token for authentication
   * @returns The resolved observer RCA URL
   */
  async resolveRCAAgentUrl(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<string> {
    if (!environmentName) {
      throw new Error('Environment is required to resolve RCA agent URL');
    }

    const mainClient = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token: userToken,
      logger: this.logger,
    });

    const {
      data: urlData,
      error: urlError,
      response: urlResponse,
    } = await mainClient.GET(
      '/namespaces/{namespaceName}/environments/{envName}/rca-agent-url',
      {
        params: {
          path: {
            namespaceName,
            envName: environmentName,
          },
        },
      },
    );

    if (urlError || !urlResponse.ok) {
      throw new Error(
        `Failed to get RCA agent URL: ${urlResponse.status} ${urlResponse.statusText}`,
      );
    }

    if (!urlData?.success || !urlData?.data) {
      throw new Error(
        `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
      );
    }

    const rcaAgentUrl = urlData.data.rcaAgentUrl;
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
      `Sending chat request to RCA agent at ${rcaAgentUrl}/chat`,
    );

    const response = await fetch(`${rcaAgentUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
      body: JSON.stringify(request),
    });

    return response;
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
