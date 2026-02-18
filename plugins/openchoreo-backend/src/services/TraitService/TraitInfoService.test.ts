import { mockServices } from '@backstage/backend-test-utils';
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
  createOpenChoreoLegacyApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: jest.fn(),
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

function createService(useNewApi = true) {
  return new TraitInfoService(mockLogger, 'http://test:8080', useNewApi);
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

describe('TraitInfoService (useNewApi=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTraits', () => {
    it('fetches traits via new API and maps to legacy shape', async () => {
      mockGET.mockResolvedValueOnce(
        okResponse({ items: [k8sTrait], pagination: {} }),
      );

      const service = createService(true);
      const result = await service.fetchTraits('test-ns', 1, 100, 'token-123');

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items![0].name).toBe('my-trait');
      expect(result.data?.items![0].displayName).toBe('My Trait');
      expect(result.data?.items![0].description).toBe('A test trait');
      expect(result.data?.items![0].createdAt).toBe('2025-01-06T10:00:00Z');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchTraits('test-ns', 1, 100, 'token'),
      ).rejects.toThrow('Failed to fetch traits');
    });
  });

  describe('fetchTraitSchema', () => {
    it('fetches trait schema and wraps in legacy shape', async () => {
      const schemaData = {
        type: 'object',
        properties: { key: { type: 'string' } },
      };
      mockGET.mockResolvedValueOnce(okResponse(schemaData));

      const service = createService(true);
      const result = await service.fetchTraitSchema(
        'test-ns',
        'my-trait',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(schemaData);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchTraitSchema('test-ns', 'my-trait', 'token'),
      ).rejects.toThrow('Failed to fetch trait schema');
    });
  });

  describe('fetchComponentTraits', () => {
    it('extracts traits from component spec', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(noTraits));

      const service = createService(true);
      const result = await service.fetchComponentTraits(
        'test-ns',
        'my-project',
        'api-service',
        'token-123',
      );

      expect(result).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.fetchComponentTraits(
          'test-ns',
          'my-project',
          'api-service',
          'token',
        ),
      ).rejects.toThrow('Failed to fetch component');
    });
  });

  describe('updateComponentTraits', () => {
    it('GETs component then PUTs with updated traits', async () => {
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));

      const updatedTraits = [{ name: 'ingress', values: { path: '/v2' } }];
      const updatedComponent = {
        ...k8sComponent,
        spec: { ...componentSpec, traits: updatedTraits },
      };
      mockPUT.mockResolvedValueOnce(okResponse(updatedComponent));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(noOwner));

      const service = createService(true);
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
      mockGET.mockResolvedValueOnce(okResponse(k8sComponent));
      mockPUT.mockResolvedValueOnce(errorResponse());

      const service = createService(true);
      await expect(
        service.updateComponentTraits(
          'test-ns',
          'my-project',
          'api-service',
          { traits: [] } as any,
          'token',
        ),
      ).rejects.toThrow('Failed to update component traits');
    });
  });
});
