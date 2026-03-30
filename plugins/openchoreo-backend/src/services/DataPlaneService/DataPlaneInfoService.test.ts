import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { DataPlaneInfoService } from './DataPlaneInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'prod-dp',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Production DP',
    'openchoreo.dev/description': 'Production data plane',
  },
};

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const k8sDataPlane = {
  metadata: baseMeta,
  spec: {
    clusterAgent: {},
    gateway: {
      ingress: {
        external: {
          http: { host: 'apps.example.com', port: 80 },
          https: { port: 443 },
        },
        internal: {
          http: { host: 'internal.example.com' },
        },
      },
    },
    imagePullSecretRefs: ['docker-secret'],
    secretStoreRef: { name: 'vault-store' },
    observabilityPlaneRef: {
      kind: 'ObservabilityPlane',
      name: 'default-obs',
    },
  },
  status: {
    conditions: [readyCondition],
    agentConnection: {
      connected: true,
      connectedAgents: 2,
      lastConnectedTime: '2025-01-06T10:00:00Z',
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new DataPlaneInfoService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataPlaneInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDataPlanes', () => {
    it('lists data planes via new API and transforms results', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sDataPlane], pagination: {} }),
      );

      const service = createService();
      const result = await service.listDataPlanes('test-ns', 'token-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('prod-dp');
      expect(result[0].gateway?.ingress?.external?.http?.host).toBe(
        'apps.example.com',
      );
      expect(result[0].gateway?.ingress?.internal?.http?.host).toBe(
        'internal.example.com',
      );
      expect(result[0].gateway?.ingress?.external?.http?.port).toBe(80);
      expect(result[0].gateway?.ingress?.external?.https?.port).toBe(443);
      expect(result[0].secretStoreRef).toBe('vault-store');
      expect(result[0].observabilityPlaneRef).toBe('default-obs');
      expect(result[0].agentConnection?.connected).toBe(true);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(service.listDataPlanes('test-ns', 'token')).rejects.toThrow();
    });
  });

  describe('fetchDataPlaneDetails', () => {
    it('fetches a single data plane and transforms it', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sDataPlane));

      const service = createService();
      const result = await service.fetchDataPlaneDetails(
        { namespaceName: 'test-ns', dataplaneName: 'prod-dp' },
        'token-123',
      );

      expect(result.name).toBe('prod-dp');
      expect(result.gateway?.ingress?.external?.http?.host).toBe(
        'apps.example.com',
      );
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchDataPlaneDetails(
          { namespaceName: 'test-ns', dataplaneName: 'prod-dp' },
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
