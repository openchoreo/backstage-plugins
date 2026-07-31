import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

export type PlatformVersion =
  OpenChoreoComponents['schemas']['VersionResponse'];

/**
 * Service for retrieving the deployed OpenChoreo platform version.
 * Calls the OpenChoreo API server's public, unauthenticated `/version`
 * endpoint (served at the API root, outside `/api/v1`).
 */
export class VersionService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchPlatformVersion(): Promise<PlatformVersion> {
    try {
      this.logger.debug('Fetching platform version');

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET('/version');
      assertApiResponse({ data, error, response }, 'fetch platform version');

      return data!;
    } catch (error: unknown) {
      this.logger.error('Error fetching platform version:', error as Error);
      throw error;
    }
  }
}
