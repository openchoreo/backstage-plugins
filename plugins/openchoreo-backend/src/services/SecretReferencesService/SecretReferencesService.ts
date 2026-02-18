import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { transformSecretReference } from '../transformers';

// Single secret reference item type from legacy OpenAPI spec
type SecretReferenceItem =
  OpenChoreoLegacyComponents['schemas']['SecretReferenceResponse'];

// The actual response shape returned by both legacy and new API code paths
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
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  async fetchSecretReferences(
    namespaceName: string,
    token?: string,
  ): Promise<ModelsSecretReferences> {
    if (this.useNewApi) {
      return this.fetchSecretReferencesNew(namespaceName, token);
    }
    return this.fetchSecretReferencesLegacy(namespaceName, token);
  }

  private async fetchSecretReferencesLegacy(
    namespaceName: string,
    token?: string,
  ): Promise<ModelsSecretReferences> {
    this.logger.debug(
      `Fetching secret references for namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
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

      const secretReferences = data as ModelsSecretReferences;
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

  private async fetchSecretReferencesNew(
    namespaceName: string,
    token?: string,
  ): Promise<ModelsSecretReferences> {
    this.logger.debug(
      `Fetching secret references (new API) for namespace: ${namespaceName}`,
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
