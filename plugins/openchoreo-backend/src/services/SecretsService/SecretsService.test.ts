import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { SecretsService } from './SecretsService';

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    DELETE: mockDELETE,
  })),
}));

const mockLogger = mockServices.logger.mock();

function createService() {
  return new SecretsService(mockLogger, 'http://test:8080');
}

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

describe('SecretsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listSecrets', () => {
    it('returns only secrets with spec.targetPlane and sorts keys', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [managedSecretRef, legacyRef],
        }),
      );

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
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [] }));

      const result = await createService().listSecrets('test-ns', 'token');

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());
      await expect(
        createService().listSecrets('test-ns', 'token'),
      ).rejects.toThrow();
    });

    it('returns secretType as undefined for unsupported template types', async () => {
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
      mockGET.mockResolvedValueOnce(createOkResponse({ items: [exoticRef] }));

      const result = await createService().listSecrets('test-ns', 'token');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('kubeadm-token');
      expect(result.items[0].secretType).toBeUndefined();
    });
  });

  describe('getSecret', () => {
    it('returns the secret when targetPlane is set', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(managedSecretRef));

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
    });

    it('throws NotFound when targetPlane is missing', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(legacyRef));
      await expect(
        createService().getSecret('test-ns', 'legacy-git', 'token'),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('createSecret', () => {
    it('POSTs the request body and returns the response', async () => {
      const created = {
        name: 'db-creds',
        namespace: 'test-ns',
        secretType: 'Opaque',
        targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
        keys: ['DB_HOST', 'DB_USER'],
      };
      mockPOST.mockResolvedValueOnce(createOkResponse(created));

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

      expect(result).toEqual(created);
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
