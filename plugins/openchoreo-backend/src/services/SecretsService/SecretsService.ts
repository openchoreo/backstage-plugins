import { LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

export type SecretType = OpenChoreoComponents['schemas']['SecretType'];
export type TargetPlaneRef = OpenChoreoComponents['schemas']['TargetPlaneRef'];
export type SecretResponse = OpenChoreoComponents['schemas']['SecretResponse'];
export type CreateSecretRequest =
  OpenChoreoComponents['schemas']['CreateSecretRequest'];
type SecretReference = OpenChoreoComponents['schemas']['SecretReference'];

export interface SecretsListResponse {
  items: SecretResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export class SecretsService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async listSecrets(
    namespaceName: string,
    token?: string,
  ): Promise<SecretsListResponse> {
    this.logger.debug(`Listing secrets for namespace: ${namespaceName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/secretreferences',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'list secrets');

      const items = (data!.items ?? [])
        .filter(ref => ref.spec?.targetPlane)
        .map(toSecretResponse);

      this.logger.debug(
        `Successfully listed ${items.length} secrets for namespace: ${namespaceName}`,
      );

      return {
        items,
        totalCount: items.length,
        page: 1,
        pageSize: items.length,
      };
    } catch (err) {
      this.logger.error(`Failed to list secrets for ${namespaceName}: ${err}`);
      throw err;
    }
  }

  async getSecret(
    namespaceName: string,
    secretName: string,
    token?: string,
  ): Promise<SecretResponse> {
    this.logger.debug(
      `Fetching secret ${secretName} from namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/secretreferences/{secretReferenceName}',
        {
          params: {
            path: { namespaceName, secretReferenceName: secretName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'get secret');

      if (!data!.spec?.targetPlane) {
        throw new NotFoundError(
          `secret '${secretName}' not found in namespace '${namespaceName}'`,
        );
      }

      return toSecretResponse(data!);
    } catch (err) {
      this.logger.error(
        `Failed to get secret ${secretName} from ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  async createSecret(
    namespaceName: string,
    body: CreateSecretRequest,
    userToken?: string,
  ): Promise<SecretResponse> {
    this.logger.debug(
      `Creating secret ${body.secretName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets',
        {
          params: { path: { namespaceName } },
          body,
        },
      );

      assertApiResponse({ data, error, response }, 'create secret');

      this.logger.debug(
        `Successfully created secret ${body.secretName} in namespace: ${namespaceName}`,
      );
      return data as SecretResponse;
    } catch (err) {
      this.logger.error(
        `Failed to create secret ${body.secretName} in ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  async deleteSecret(
    namespaceName: string,
    secretName: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting secret ${secretName} from namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { error, response } = await client.DELETE(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}',
        {
          params: { path: { namespaceName, secretName } },
        },
      );

      assertApiResponse({ error, response }, 'delete secret');

      this.logger.debug(
        `Successfully deleted secret ${secretName} from namespace: ${namespaceName}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete secret ${secretName} from ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }
}

const SUPPORTED_SECRET_TYPES: ReadonlySet<SecretType> = new Set([
  'Opaque',
  'kubernetes.io/basic-auth',
  'kubernetes.io/ssh-auth',
  'kubernetes.io/dockerconfigjson',
  'kubernetes.io/tls',
]);

function toSecretType(raw: string | undefined): SecretType | undefined {
  if (raw && SUPPORTED_SECRET_TYPES.has(raw as SecretType)) {
    return raw as SecretType;
  }
  return undefined;
}

function toSecretResponse(ref: SecretReference): SecretResponse {
  const keys = (ref.spec?.data ?? [])
    .map(d => d.secretKey)
    .sort((a, b) => a.localeCompare(b));

  return {
    name: ref.metadata?.name ?? '',
    namespace: ref.metadata?.namespace ?? '',
    secretType: toSecretType(ref.spec?.template?.type),
    targetPlane: ref.spec?.targetPlane,
    keys,
  };
}
