import { LoggerService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

export type SecretType = OpenChoreoComponents['schemas']['SecretType'];
export type TargetPlaneRef = OpenChoreoComponents['schemas']['TargetPlaneRef'];
export type CreateSecretRequest =
  OpenChoreoComponents['schemas']['CreateSecretRequest'];
export type UpdateSecretRequest =
  OpenChoreoComponents['schemas']['UpdateSecretRequest'];
type SecretReference = OpenChoreoComponents['schemas']['SecretReference'];
type ListSecretsResponse =
  OpenChoreoComponents['schemas']['ListSecretsResponse'];
type SecretObject = OpenChoreoComponents['schemas']['Secret'];

/**
 * Flat projection of a K8s Secret joined with its SecretReference for
 * targetPlane. The BFF returns this shape so frontend consumers don't need
 * to know about the K8s metadata/spec wrapper or the separate reference.
 */
export interface SecretResponse {
  name: string;
  namespace: string;
  secretType?: SecretType;
  targetPlane?: TargetPlaneRef;
  keys: string[];
}

export interface SecretsListResponse {
  items: SecretResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Secret detail returned by getSecret. `data` carries base64-encoded values
 * exactly as Kubernetes returns them; the frontend decodes when populating
 * the edit dialog. Treat as sensitive — never log this object's `data`.
 */
export interface SecretDetail extends SecretResponse {
  /** Base64-encoded value map (K8s Secret wire format). */
  data: Record<string, string>;
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

      // Fetch secrets (new API) and secretreferences (for targetPlane) in parallel.
      // The new /secrets endpoint returns plain corev1.Secret objects without
      // the targetPlane field, so we join with SecretReferences by name to
      // surface targetPlane info in the table.
      const [secretsRes, refsRes] = await Promise.all([
        client.GET('/api/v1alpha1/namespaces/{namespaceName}/secrets', {
          params: { path: { namespaceName } },
        }),
        client.GET('/api/v1/namespaces/{namespaceName}/secretreferences', {
          params: { path: { namespaceName } },
        }),
      ]);

      assertApiResponse(secretsRes, 'list secrets');
      assertApiResponse(refsRes, 'list secret references');

      const secrets = (secretsRes.data as ListSecretsResponse).items ?? [];
      const refs = refsRes.data!.items ?? [];

      const refByName = new Map<string, SecretReference>();
      for (const ref of refs) {
        const name = ref.metadata?.name;
        if (name) refByName.set(name, ref);
      }

      const items: SecretResponse[] = secrets.map(secret => {
        const name = secret.metadata?.name ?? '';
        const ref = refByName.get(name);
        return projectSecret(secret, ref, name, namespaceName);
      });

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
  ): Promise<SecretDetail> {
    this.logger.debug(
      `Fetching secret ${secretName} from namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch the K8s Secret (with base64 data) and the SecretReference
      // (for targetPlane info) in parallel.
      const [secretRes, refRes] = await Promise.all([
        client.GET(
          '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}',
          { params: { path: { namespaceName, secretName } } },
        ),
        client.GET(
          '/api/v1/namespaces/{namespaceName}/secretreferences/{secretReferenceName}',
          {
            params: {
              path: { namespaceName, secretReferenceName: secretName },
            },
          },
        ),
      ]);

      assertApiResponse(secretRes, 'get secret');
      assertApiResponse(refRes, 'get secret reference');

      const secret = secretRes.data as SecretObject;
      const ref = refRes.data!;

      if (!ref.spec?.targetPlane) {
        throw new NotFoundError(
          `secret '${secretName}' not found in namespace '${namespaceName}'`,
        );
      }

      const data = (secret.data ?? {}) as Record<string, string>;
      return {
        ...projectSecret(secret, ref, secretName, namespaceName),
        data,
      };
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

      const postRes = await client.POST(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets',
        {
          params: { path: { namespaceName } },
          body,
        },
      );
      assertApiResponse(postRes, 'create secret');

      this.logger.debug(
        `Successfully created secret ${body.secretName} in namespace: ${namespaceName}`,
      );
      // targetPlane is not on the K8s Secret response; the only frontend
      // consumer awaits this call for completion and refreshes via list,
      // so we leave the optional field undefined to avoid an extra GET.
      return projectSecret(
        postRes.data as SecretObject,
        undefined,
        body.secretName,
        namespaceName,
      );
    } catch (err) {
      this.logger.error(
        `Failed to create secret ${body.secretName} in ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  async updateSecret(
    namespaceName: string,
    secretName: string,
    body: UpdateSecretRequest,
    userToken?: string,
  ): Promise<SecretResponse> {
    this.logger.debug(
      `Updating secret ${secretName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const putRes = await client.PUT(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}',
        {
          params: { path: { namespaceName, secretName } },
          body,
        },
      );
      assertApiResponse(putRes, 'update secret');

      this.logger.debug(
        `Successfully updated secret ${secretName} in namespace: ${namespaceName}`,
      );
      // See createSecret: targetPlane is left undefined here too.
      return projectSecret(
        putRes.data as SecretObject,
        undefined,
        secretName,
        namespaceName,
      );
    } catch (err) {
      this.logger.error(
        `Failed to update secret ${secretName} in ${namespaceName}: ${err}`,
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

/**
 * Project a K8s Secret + SecretReference into the flat BFF response shape.
 * `targetPlane` comes from the reference; everything else from the Secret.
 */
function projectSecret(
  secret: SecretObject,
  ref: SecretReference | undefined,
  fallbackName: string,
  fallbackNamespace: string,
): SecretResponse {
  return {
    name: secret.metadata?.name ?? fallbackName,
    namespace: secret.metadata?.namespace ?? fallbackNamespace,
    secretType: toSecretType(secret.type),
    targetPlane: ref?.spec?.targetPlane,
    keys: Object.keys(secret.data ?? {}).sort((a, b) => a.localeCompare(b)),
  };
}
