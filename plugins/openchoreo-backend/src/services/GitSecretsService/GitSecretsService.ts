import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use the generated types from OpenAPI spec
export type GitSecretResponse =
  OpenChoreoComponents['schemas']['GitSecretResponse'];

export interface GitSecretListResponse {
  items: GitSecretResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export class GitSecretsService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async listGitSecrets(
    namespaceName: string,
    token?: string,
  ): Promise<GitSecretListResponse> {
    this.logger.debug(`Listing git secrets for namespace: ${namespaceName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/git-secrets',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to list git secrets: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      // Extract the list response data
      const listData = data.data as GitSecretListResponse;
      this.logger.debug(
        `Successfully listed ${listData.items?.length || 0} git secrets for namespace: ${namespaceName}`,
      );
      return listData;
    } catch (err) {
      this.logger.error(
        `Failed to list git secrets for ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  async createGitSecret(
    namespaceName: string,
    secretName: string,
    gitToken: string,
    userToken?: string,
  ): Promise<GitSecretResponse> {
    this.logger.debug(
      `Creating git secret ${secretName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/namespaces/{namespaceName}/git-secrets',
        {
          params: {
            path: { namespaceName },
          },
          body: {
            secretName,
            token: gitToken,
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage =
          response.status === 409
            ? 'Git secret already exists'
            : `Failed to create git secret: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(data)}`,
        );
      }

      const secretResponse = data.data as GitSecretResponse;
      this.logger.debug(
        `Successfully created git secret ${secretName} in namespace: ${namespaceName}`,
      );
      return secretResponse;
    } catch (err) {
      this.logger.error(
        `Failed to create git secret ${secretName} in ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  async deleteGitSecret(
    namespaceName: string,
    secretName: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting git secret ${secretName} from namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/namespaces/{namespaceName}/git-secrets/{secretName}',
        {
          params: {
            path: { namespaceName, secretName },
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage =
          response.status === 404
            ? 'Git secret not found'
            : `Failed to delete git secret: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      this.logger.debug(
        `Successfully deleted git secret ${secretName} from namespace: ${namespaceName}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete git secret ${secretName} from ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }
}
