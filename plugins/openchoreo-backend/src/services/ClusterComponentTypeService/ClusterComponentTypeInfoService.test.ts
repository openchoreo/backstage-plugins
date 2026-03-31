import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { ClusterComponentTypeInfoService } from './ClusterComponentTypeInfoService';

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
  name: 'go-service',
  namespace: 'default',
  uid: 'cct-uid-001',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Go Service',
    'openchoreo.dev/description': 'A Go service component type',
  },
};

const k8sClusterComponentType = {
  metadata: baseMeta,
  spec: {
    workloadType: 'deployment',
    allowedWorkflows: ['docker-build', 'go-build'],
    allowedTraits: ['ingress', 'scaling'],
  },
  status: { conditions: [] },
};

const mockLogger = mockServices.logger.mock();

function createService() {
  return new ClusterComponentTypeInfoService(mockLogger, 'http://test:8080');
}

describe('ClusterComponentTypeInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchClusterComponentTypes', () => {
    it('fetches and transforms cluster component types', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sClusterComponentType],
          pagination: {},
        }),
      );

      const service = createService();
      const result = await service.fetchClusterComponentTypes('token-123');

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items![0].name).toBe('go-service');
      expect(result.data?.items![0].displayName).toBe('Go Service');
      expect(result.data?.items![0].workloadType).toBe('deployment');
      expect(result.data?.items![0].allowedWorkflows).toEqual([
        'docker-build',
        'go-build',
      ]);
      expect(result.data?.totalCount).toBe(1);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchClusterComponentTypes('token'),
      ).rejects.toThrow();
    });
  });

  describe('fetchClusterComponentTypeSchema', () => {
    it('fetches schema for a cluster component type', async () => {
      const schema = { type: 'object', properties: { port: { type: 'integer' } } };
      mockGET.mockResolvedValueOnce(createOkResponse(schema));

      const service = createService();
      const result = await service.fetchClusterComponentTypeSchema(
        'go-service',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(schema);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchClusterComponentTypeSchema('go-service', 'token'),
      ).rejects.toThrow();
    });
  });
});
