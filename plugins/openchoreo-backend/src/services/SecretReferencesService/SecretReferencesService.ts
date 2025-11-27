import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated type from OpenAPI spec
export type ModelsSecretReferences =
  OpenChoreoComponents['schemas']['SecretReferenceResponse'];

export class SecretReferencesService {
  private logger: LoggerService;
  private baseUrl: string;
  private token?: string;

  constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async fetchSecretReferences(
    orgName: string,
  ): Promise<ModelsSecretReferences> {
    this.logger.debug(
      `Fetching secret references for organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/secret-references',
        {
          params: {
            path: { orgName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch secret references: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      const secretReferences: ModelsSecretReferences =
        data as ModelsSecretReferences;
      this.logger.debug(
        `Successfully fetched secret references for organization: ${orgName}`,
      );
      return secretReferences;
    } catch (error) {
      this.logger.error(
        `Failed to fetch secret references for ${orgName}: ${error}`,
      );
      throw error;
    }
  }
}
