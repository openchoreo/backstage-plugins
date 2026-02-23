import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { transformSecretReference } from '../transformers';

// Single secret reference item type from legacy OpenAPI spec
type SecretReferenceItem =
  OpenChoreoLegacyComponents['schemas']['SecretReferenceResponse'];

// The actual response shape returned by the API
export interface ModelsSecretReferences {
  success: boolean;
  data: {
    items: SecretReferenceItem[];
    total: number;
  };
}

export class SecretReferencesService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string, _useNewApi = false) {
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
        '/api/v1/namespaces/{namespaceName}/secret-references',
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

      const items = data.items.map(transformSecretReference);

      this.logger.debug(
        `Successfully fetched ${items.length} secret references for namespace: ${namespaceName}`,
      );

      // Return in legacy response shape for backward compatibility
      return {
        success: true,
        data: {
          items,
          total: items.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch secret references for ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }
}
