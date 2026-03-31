import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { ClusterTraitInfoService } from './ClusterTraitInfoService';

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
  name: 'ingress',
  uid: 'trait-uid-001',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Ingress',
    'openchoreo.dev/description': 'Ingress trait for services',
  },
};

const k8sClusterTrait = {
  metadata: baseMeta,
  spec: { schema: { type: 'object' } },
  status: { conditions: [] },
};

const mockLogger = mockServices.logger.mock();

function createService() {
  return new ClusterTraitInfoService(mockLogger, 'http://test:8080');
}

describe('ClusterTraitInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchClusterTraits', () => {
    it('fetches and transforms cluster traits', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sClusterTrait], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchClusterTraits('token-123');

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items![0].name).toBe('ingress');
      expect(result.data?.items![0].displayName).toBe('Ingress');
      expect(result.data?.items![0].description).toBe(
        'Ingress trait for services',
      );
      expect(result.data?.totalCount).toBe(1);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(service.fetchClusterTraits('token')).rejects.toThrow();
    });
  });

  describe('fetchClusterTraitSchema', () => {
    it('fetches schema for a cluster trait', async () => {
      const schema = {
        type: 'object',
        properties: { path: { type: 'string' } },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(schema));

      const service = createService();
      const result = await service.fetchClusterTraitSchema(
        'ingress',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(schema);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchClusterTraitSchema('ingress', 'token'),
      ).rejects.toThrow();
    });
  });
});
