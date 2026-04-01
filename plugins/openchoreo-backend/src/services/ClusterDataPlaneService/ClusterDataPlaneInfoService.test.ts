import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { ClusterDataPlaneInfoService } from './ClusterDataPlaneInfoService';

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

const baseMeta = {
  name: 'cluster-dp-1',
  uid: 'cdp-uid-001',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Cluster DP 1',
    'openchoreo.dev/description': 'A cluster data plane',
  },
};

const k8sClusterDataPlane = {
  metadata: baseMeta,
  spec: {
    clusterAgent: {},
    gateway: {
      ingress: {
        external: {
          name: 'ext',
          namespace: 'infra',
          http: { host: 'apps.example.com', port: 80 },
          https: { port: 443 },
        },
      },
    },
    secretStoreRef: { name: 'vault-store' },
    observabilityPlaneRef: { kind: 'ClusterObservabilityPlane', name: 'obs' },
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Ready',
      },
    ],
    agentConnection: { connected: true, connectedAgents: 2 },
  },
};

const mockLogger = mockServices.logger.mock();

function createService() {
  return new ClusterDataPlaneInfoService(mockLogger, 'http://test:8080');
}

describe('ClusterDataPlaneInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listClusterDataPlanes', () => {
    it('lists and transforms cluster data planes', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sClusterDataPlane],
          pagination: {},
        }),
      );

      const service = createService();
      const result = await service.listClusterDataPlanes('token-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cluster-dp-1');
      expect(result[0].gateway?.ingress?.external?.http?.host).toBe(
        'apps.example.com',
      );
      expect(result[0].secretStoreRef).toBe('vault-store');
      expect(result[0].agentConnection?.connected).toBe(true);
      expect(result[0].status).toBe('Ready');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(service.listClusterDataPlanes('token')).rejects.toThrow();
    });
  });

  describe('fetchClusterDataPlaneDetails', () => {
    it('fetches and transforms a single cluster data plane', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sClusterDataPlane));

      const service = createService();
      const result = await service.fetchClusterDataPlaneDetails(
        { name: 'cluster-dp-1' },
        'token-123',
      );

      expect(result.name).toBe('cluster-dp-1');
      expect(result.observabilityPlaneRef).toBe('obs');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchClusterDataPlaneDetails({ name: 'dp-1' }, 'token'),
      ).rejects.toThrow();
    });
  });
});
