import { mockServices } from '@backstage/backend-test-utils';
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
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
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
      publicVirtualHost: 'apps.example.com',
      organizationVirtualHost: 'internal.example.com',
      publicHTTPPort: 80,
      publicHTTPSPort: 443,
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

function createService(useNewApi = true) {
  return new DataPlaneInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('DataPlaneInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDataPlanes', () => {
    it('lists data planes via new API and transforms results', async () => {
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sDataPlane], pagination: {} }),
      );

      const service = createService(true);
      const result = await service.listDataPlanes('test-ns', 'token-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('prod-dp');
      expect(result[0].publicVirtualHost).toBe('apps.example.com');
      expect(result[0].namespaceVirtualHost).toBe('internal.example.com');
      expect(result[0].publicHTTPPort).toBe(80);
      expect(result[0].publicHTTPSPort).toBe(443);
      expect(result[0].secretStoreRef).toBe('vault-store');
      expect(result[0].observabilityPlaneRef).toBe('default-obs');
      expect(result[0].agentConnection?.connected).toBe(true);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(service.listDataPlanes('test-ns', 'token')).rejects.toThrow(
        'Failed to list data planes',
      );
    });
  });

  describe('fetchDataPlaneDetails', () => {
    it('fetches a single data plane and transforms it', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sDataPlane));

      const service = createService(true);
      const result = await service.fetchDataPlaneDetails(
        { namespaceName: 'test-ns', dataplaneName: 'prod-dp' },
        'token-123',
      );

      expect(result.name).toBe('prod-dp');
      expect(result.publicVirtualHost).toBe('apps.example.com');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchDataPlaneDetails(
          { namespaceName: 'test-ns', dataplaneName: 'prod-dp' },
          'token',
        ),
      ).rejects.toThrow('Failed to fetch data plane');
    });
  });
});
