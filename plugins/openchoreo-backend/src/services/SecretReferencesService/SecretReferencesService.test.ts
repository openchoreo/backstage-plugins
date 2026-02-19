import { mockServices } from '@backstage/backend-test-utils';
import { SecretReferencesService } from './SecretReferencesService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'db-secret',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'DB Secret',
    'openchoreo.dev/description': 'Database credentials',
  },
};

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const k8sSecretRef = {
  metadata: baseMeta,
  spec: {
    template: { type: 'Opaque' },
    data: [
      {
        secretKey: 'password',
        remoteRef: {
          key: 'prod/db/password',
          property: 'value',
          version: '1',
        },
      },
    ],
    refreshInterval: '1h',
  },
  status: {
    conditions: [readyCondition],
    lastRefreshTime: '2025-01-06T11:00:00Z',
    secretStores: [{ name: 'vault', namespace: 'infra', kind: 'SecretStore' }],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService(useNewApi = true) {
  return new SecretReferencesService(mockLogger, 'http://test:8080', useNewApi);
}

function okResponse(data: any) {
  return { data, error: undefined, response: { ok: true, status: 200 } };
}

function errorResponse(status = 500) {
  return {
    data: undefined,
    error: { message: 'fail' },
    response: { ok: false, status, statusText: 'Internal Server Error' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SecretReferencesService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSecretReferences', () => {
    it('fetches and transforms secret references via new API', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [k8sSecretRef] }));

      const service = createService(true);
      const result = await service.fetchSecretReferences(
        'test-ns',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(1);

      const item = result.data.items[0];
      expect(item.name).toBe('db-secret');
      expect(item.data).toHaveLength(1);
      expect(item.data![0].secretKey).toBe('password');
      expect(item.data![0].remoteRef.key).toBe('prod/db/password');
      expect(item.refreshInterval).toBe('1h');
      expect(item.lastRefreshTime).toBe('2025-01-06T11:00:00Z');
      expect(item.secretStores).toHaveLength(1);
      expect(item.secretStores![0].name).toBe('vault');
      expect(item.status).toBe('Ready');
    });

    it('returns empty list when no secrets exist', async () => {
      mockGET.mockResolvedValueOnce(okResponse({ items: [] }));

      const service = createService(true);
      const result = await service.fetchSecretReferences(
        'test-ns',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(0);
      expect(result.data.total).toBe(0);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchSecretReferences('test-ns', 'token'),
      ).rejects.toThrow('Failed to fetch secret references');
    });
  });
});
