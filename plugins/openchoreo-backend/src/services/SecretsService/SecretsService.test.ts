import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { SecretsService } from './SecretsService';

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockPUT = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PUT: mockPUT,
    DELETE: mockDELETE,
  })),
}));

const mockLogger = mockServices.logger.mock();

function createService() {
  return new SecretsService(mockLogger, 'http://test:8080');
}

const SECRETS_LIST_PATH = '/api/v1alpha1/namespaces/{namespaceName}/secrets';
const SECRETREFS_LIST_PATH =
  '/api/v1/namespaces/{namespaceName}/secretreferences';
const SECRET_GET_PATH =
  '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}';
const SECRETREF_GET_PATH =
  '/api/v1/namespaces/{namespaceName}/secretreferences/{secretReferenceName}';

const managedSecretRef = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'SecretReference',
  metadata: { name: 'db-creds', namespace: 'test-ns' },
  spec: {
    template: { type: 'Opaque' },
    targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
    data: [
      { secretKey: 'DB_USER', remoteRef: { key: 'foo', property: 'DB_USER' } },
      { secretKey: 'DB_HOST', remoteRef: { key: 'foo', property: 'DB_HOST' } },
    ],
  },
};

const legacyRef = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'SecretReference',
  metadata: { name: 'legacy-git', namespace: 'test-ns' },
  spec: {
    template: { type: 'kubernetes.io/basic-auth' },
    data: [
      {
        secretKey: 'password',
        remoteRef: { key: 'git/foo', property: 'password' },
      },
    ],
  },
};

// New /secrets endpoint returns plain corev1.Secret objects with base64 data.
const dbCredsSecret = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: { name: 'db-creds', namespace: 'test-ns' },
  type: 'Opaque',
  data: {
    DB_USER: 'YWxpY2U=', // alice
    DB_HOST: 'ZGIubG9jYWw=', // db.local
  },
};

/**
 * Wires the GET mock to respond based on path so listSecrets/getSecret tests
 * don't depend on call order between the two parallel requests.
 */
function mockGetByPath(handlers: Record<string, unknown>) {
  mockGET.mockImplementation((path: string) => {
    const r = handlers[path];
    if (r === undefined) {
      throw new Error(`Unexpected GET to ${path}`);
    }
    return Promise.resolve(r);
  });
}

describe('SecretsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listSecrets', () => {
    it('joins /secrets data with secretreferences for targetPlane and sorts keys', async () => {
      mockGetByPath({
        [SECRETS_LIST_PATH]: createOkResponse({ items: [dbCredsSecret] }),
        [SECRETREFS_LIST_PATH]: createOkResponse({
          items: [managedSecretRef, legacyRef],
        }),
      });

      const result = await createService().listSecrets('test-ns', 'token');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        name: 'db-creds',
        namespace: 'test-ns',
        secretType: 'Opaque',
        targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
        keys: ['DB_HOST', 'DB_USER'],
      });
      expect(result.totalCount).toBe(1);
    });

    it('handles empty list', async () => {
      mockGetByPath({
        [SECRETS_LIST_PATH]: createOkResponse({ items: [] }),
        [SECRETREFS_LIST_PATH]: createOkResponse({ items: [] }),
      });

      const result = await createService().listSecrets('test-ns', 'token');

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('throws on API error', async () => {
      mockGetByPath({
        [SECRETS_LIST_PATH]: createErrorResponse(),
        [SECRETREFS_LIST_PATH]: createOkResponse({ items: [] }),
      });
      await expect(
        createService().listSecrets('test-ns', 'token'),
      ).rejects.toThrow();
    });

    it('returns secretType as undefined for unsupported types', async () => {
      const exoticSecret = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'kubeadm-token', namespace: 'test-ns' },
        type: 'bootstrap.kubernetes.io/token',
        data: {},
      };
      const exoticRef = {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'SecretReference',
        metadata: { name: 'kubeadm-token', namespace: 'test-ns' },
        spec: {
          template: { type: 'bootstrap.kubernetes.io/token' },
          targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
          data: [],
        },
      };
      mockGetByPath({
        [SECRETS_LIST_PATH]: createOkResponse({ items: [exoticSecret] }),
        [SECRETREFS_LIST_PATH]: createOkResponse({ items: [exoticRef] }),
      });

      const result = await createService().listSecrets('test-ns', 'token');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('kubeadm-token');
      expect(result.items[0].secretType).toBeUndefined();
    });
  });

  describe('getSecret', () => {
    it('returns the secret with base64 data and targetPlane from the ref', async () => {
      mockGetByPath({
        [SECRET_GET_PATH]: createOkResponse(dbCredsSecret),
        [SECRETREF_GET_PATH]: createOkResponse(managedSecretRef),
      });

      const result = await createService().getSecret(
        'test-ns',
        'db-creds',
        'token',
      );

      expect(result.name).toBe('db-creds');
      expect(result.targetPlane).toEqual({
        kind: 'DataPlane',
        name: 'dp-prod',
      });
      expect(result.keys).toEqual(['DB_HOST', 'DB_USER']);
      expect(result.data).toEqual({
        DB_USER: 'YWxpY2U=',
        DB_HOST: 'ZGIubG9jYWw=',
      });
    });

    it('throws NotFound when targetPlane is missing on the ref', async () => {
      mockGetByPath({
        [SECRET_GET_PATH]: createOkResponse(dbCredsSecret),
        [SECRETREF_GET_PATH]: createOkResponse(legacyRef),
      });
      await expect(
        createService().getSecret('test-ns', 'legacy-git', 'token'),
      ).rejects.toThrow(/not found/i);
    });

    it('surfaces labels from the SecretReference so categories survive edits', async () => {
      const refWithLabels = {
        ...managedSecretRef,
        metadata: {
          ...managedSecretRef.metadata,
          labels: {
            'openchoreo.dev/secret-type': 'git-credentials',
            'openchoreo.dev/managed-by': 'openchoreo-api',
          },
        },
      };
      mockGetByPath({
        [SECRET_GET_PATH]: createOkResponse(dbCredsSecret),
        [SECRETREF_GET_PATH]: createOkResponse(refWithLabels),
      });

      const result = await createService().getSecret(
        'test-ns',
        'db-creds',
        'token',
      );

      expect(result.labels).toEqual({
        'openchoreo.dev/secret-type': 'git-credentials',
        'openchoreo.dev/managed-by': 'openchoreo-api',
      });
    });
  });

  describe('createSecret', () => {
    it('POSTs the request body and projects the K8s Secret response', async () => {
      // The new API returns the K8s Secret shape. targetPlane is not on the
      // response (it lives on the SecretReference); the BFF leaves the field
      // undefined and the UI refreshes via list.
      mockPOST.mockResolvedValueOnce(createOkResponse(dbCredsSecret));

      const result = await createService().createSecret(
        'test-ns',
        {
          secretName: 'db-creds',
          secretType: 'Opaque',
          targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
          data: { DB_USER: 'alice', DB_HOST: 'db.local' },
        },
        'token',
      );

      expect(result).toEqual({
        name: 'db-creds',
        namespace: 'test-ns',
        secretType: 'Opaque',
        targetPlane: undefined,
        keys: ['DB_HOST', 'DB_USER'],
      });
      expect(mockPOST).toHaveBeenCalledWith(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets',
        expect.objectContaining({
          params: { path: { namespaceName: 'test-ns' } },
          body: expect.objectContaining({ secretName: 'db-creds' }),
        }),
      );
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());
      await expect(
        createService().createSecret(
          'test-ns',
          {
            secretName: 'x',
            secretType: 'Opaque',
            targetPlane: { kind: 'DataPlane', name: 'dp' },
            data: { k: 'v' },
          },
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('updateSecret', () => {
    it('PUTs the request body and projects the K8s Secret response', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(dbCredsSecret));

      const result = await createService().updateSecret(
        'test-ns',
        'db-creds',
        { data: { DB_USER: 'bob', DB_HOST: 'db.local' } },
        'token',
      );

      expect(result).toEqual({
        name: 'db-creds',
        namespace: 'test-ns',
        secretType: 'Opaque',
        targetPlane: undefined,
        keys: ['DB_HOST', 'DB_USER'],
      });
      expect(mockPUT).toHaveBeenCalledWith(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}',
        expect.objectContaining({
          params: {
            path: { namespaceName: 'test-ns', secretName: 'db-creds' },
          },
          body: expect.objectContaining({ data: expect.any(Object) }),
        }),
      );
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());
      await expect(
        createService().updateSecret(
          'test-ns',
          'db-creds',
          { data: { k: 'v' } },
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('deleteSecret', () => {
    it('DELETEs the secret', async () => {
      mockDELETE.mockResolvedValueOnce(createOkResponse(undefined));

      await createService().deleteSecret('test-ns', 'db-creds', 'token');

      expect(mockDELETE).toHaveBeenCalledWith(
        '/api/v1alpha1/namespaces/{namespaceName}/secrets/{secretName}',
        expect.objectContaining({
          params: {
            path: { namespaceName: 'test-ns', secretName: 'db-creds' },
          },
        }),
      );
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce(createErrorResponse());
      await expect(
        createService().deleteSecret('test-ns', 'db-creds', 'token'),
      ).rejects.toThrow();
    });
  });
});
