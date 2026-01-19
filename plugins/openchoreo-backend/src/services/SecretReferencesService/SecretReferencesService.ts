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

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchSecretReferences(
    namespaceName: string,
    token?: string,
  ): Promise<ModelsSecretReferences> {
    this.logger.debug(
      `Fetching secret references for namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/secret-references',
        {
          params: {
            path: { namespaceName },
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
        `Successfully fetched secret references for namespace: ${namespaceName}`,
      );
      return secretReferences;
    } catch (error) {
      this.logger.error(
        `Failed to fetch secret references for ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }
}
