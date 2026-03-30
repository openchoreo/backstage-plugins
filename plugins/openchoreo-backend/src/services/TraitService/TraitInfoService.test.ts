import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { TraitInfoService } from './TraitInfoService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPUT = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: mockPUT,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseMeta = {
  name: 'my-trait',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'My Trait',
    'openchoreo.dev/description': 'A test trait',
  },
};

const k8sTrait = {
  metadata: baseMeta,
  spec: { schema: { type: 'object' } },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
    ],
  },
};

const componentSpec = {
  owner: { projectName: 'my-project' },
  type: 'Service',
  traits: [
    { name: 'ingress', values: { path: '/api' } },
    { name: 'scaling', values: { minReplicas: 1 } },
  ],
};

const k8sComponent = {
  metadata: { ...baseMeta, name: 'api-service' },
  spec: componentSpec,
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2025-01-06T10:00:05Z',
        reason: 'Reconciled',
        message: 'Resource is ready',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new TraitInfoService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraitInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTraits', () => {
    it('fetches traits via new API and maps to legacy shape', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sTrait], pagination: {} }),
      );

      const service = createService();
      const result = await service.fetchTraits('test-ns', 1, 100, 'token-123');

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items![0].name).toBe('my-trait');
      expect(result.data?.items![0].displayName).toBe('My Trait');
      expect(result.data?.items![0].description).toBe('A test trait');
      expect(result.data?.items![0].createdAt).toBe('2025-01-06T10:00:00Z');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchTraits('test-ns', 1, 100, 'token'),
      ).rejects.toThrow();
    });
  });

  describe('fetchTraitSchema', () => {
    it('fetches trait schema and wraps in legacy shape', async () => {
      const schemaData = {
        type: 'object',
        properties: { key: { type: 'string' } },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(schemaData));

      const service = createService();
      const result = await service.fetchTraitSchema(
        'test-ns',
        'my-trait',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(schemaData);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchTraitSchema('test-ns', 'my-trait', 'token'),
      ).rejects.toThrow();
    });
  });

  describe('fetchComponentTraits', () => {
    it('extracts traits from component spec', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sComponent));

      const service = createService();
      const result = await service.fetchComponentTraits(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('ingress');
      expect(result[1].name).toBe('scaling');
    });

    it('returns empty array when component has no traits', async () => {
      const noTraits = {
        ...k8sComponent,
        spec: { ...componentSpec, traits: undefined },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(noTraits));

      const service = createService();
      const result = await service.fetchComponentTraits(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.fetchComponentTraits(
          'test-ns',
          'my-project',
          'api-service',
          'token',
        ),
      ).rejects.toThrow();
    });
  });

  describe('updateComponentTraits', () => {
    it('GETs component then PUTs with updated traits', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sComponent));

      const updatedTraits = [{ name: 'ingress', values: { path: '/v2' } }];
      const updatedComponent = {
        ...k8sComponent,
        spec: { ...componentSpec, traits: updatedTraits },
      };
      mockPUT.mockResolvedValueOnce(createOkResponse(updatedComponent));

      const service = createService();
      const result = await service.updateComponentTraits(
        'test-ns',
        'my-project',
        'api-service',
        { traits: updatedTraits } as any,
        'token-123',
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ingress');
      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });

    it('throws when component is missing spec.owner', async () => {
      const noOwner = {
        ...k8sComponent,
        spec: { traits: [] },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(noOwner));

      const service = createService();
      await expect(
        service.updateComponentTraits(
          'test-ns',
          'my-project',
          'api-service',
          { traits: [] } as any,
          'token',
        ),
      ).rejects.toThrow('missing spec.owner');
    });

    it('throws when PUT fails', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sComponent));
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.updateComponentTraits(
          'test-ns',
          'my-project',
          'api-service',
          { traits: [] } as any,
          'token',
        ),
      ).rejects.toThrow();
    });
  });
});
