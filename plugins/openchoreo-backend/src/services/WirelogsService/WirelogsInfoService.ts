import { LoggerService } from '@backstage/backend-plugin-api';

export interface WirelogsStreamRequest {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  componentName?: string;
}

/**
 * Opens an upstream SSE stream to the OpenChoreo API's wirelogs endpoint
 * and returns the raw Response. The router pipes the body to the browser.
 *
 * When a component is supplied, the upstream Hubble filter scopes flows to
 * those whose source or destination carries the component label, so the
 * frontend does not need to re-filter by component.
 */
export class WirelogsInfoService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    // Mirror createOpenChoreoApiClient: the configured baseUrl may already end
    // in /api/v1, so strip it here and re-add it in the path below to avoid a
    // doubled /api/v1/api/v1 prefix.
    this.baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
  }

  async openStream(
    request: WirelogsStreamRequest,
    userToken: string | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    const url = new URL(
      `${this.baseUrl}/api/v1/namespaces/${encodeURIComponent(
        request.namespaceName,
      )}/environments/${encodeURIComponent(request.environmentName)}/wirelogs`,
    );
    url.searchParams.set('project', request.projectName);
    if (request.componentName) {
      url.searchParams.set('component', request.componentName);
    }

    this.logger.debug(`Opening wirelogs SSE stream to ${url.toString()}`);

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };
    if (userToken) {
      headers.Authorization = `Bearer ${userToken}`;
    }

    return fetch(url.toString(), {
      method: 'GET',
      headers,
      signal,
    });
  }
}
