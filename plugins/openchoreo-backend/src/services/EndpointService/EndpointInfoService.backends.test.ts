import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { EndpointInfoService } from './EndpointInfoService';

const mockGET = jest.fn();
const mockPUT = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    PUT: mockPUT,
  })),
}));

const ref = { namespaceName: 'acme', endpointName: 'orders-api' };

function backend(component: string, endpoint: string, weight = 1) {
  return {
    name: `${component}-${endpoint}`,
    kind: 'Component' as const,
    component: { name: component, endpoint },
    weight,
  };
}

function endpointWith(backendRefs: ReturnType<typeof backend>[]) {
  return {
    metadata: {
      name: 'orders-api',
      resourceVersion: '7',
      labels: { 'openchoreo.dev/project': 'store' },
    },
    spec: {
      owner: { projectName: 'store', componentName: 'orders' },
      type: { kind: 'ClusterEndpointType', name: 'http-route' },
      visibility: ['external'],
      backendRefs,
    },
  };
}

/** The body of the PUT the service sent. */
function sentBody() {
  expect(mockPUT).toHaveBeenCalledTimes(1);
  return mockPUT.mock.calls[0][1].body;
}

describe('EndpointInfoService backends', () => {
  let service: EndpointInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EndpointInfoService(
      mockServices.logger.mock(),
      'http://test:8080',
    );
    mockPUT.mockResolvedValue(createOkResponse({}));
  });

  describe('addEndpointBackend', () => {
    it('appends a backend named after its component and endpoint', async () => {
      const existing = endpointWith([backend('orders', 'api')]);
      mockGET.mockResolvedValue(createOkResponse(existing));

      const result = await service.addEndpointBackend(
        { ...ref, component: 'payments', workloadEndpoint: 'http', weight: 3 },
        'token',
      );

      expect(result).toEqual({
        name: 'orders-api',
        backendName: 'payments-http',
      });
      const body = sentBody();
      // Ownership is left to the API, which moves the Endpoint to its project.
      expect(body.metadata).toEqual(existing.metadata);
      expect(body.spec.owner).toEqual(existing.spec.owner);
      expect(body.spec.backendRefs).toEqual([
        backend('orders', 'api'),
        backend('payments', 'http', 3),
      ]);
    });

    it('defaults the weight to 1 and keeps backend names unique', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith([
            { ...backend('orders', 'api'), name: 'payments-http' },
          ]),
        ),
      );

      const result = await service.addEndpointBackend({
        ...ref,
        component: 'payments',
        workloadEndpoint: 'http',
      });

      expect(result.backendName).toBe('payments-http-2');
      expect(sentBody().spec.backendRefs[1].weight).toBe(1);
    });

    it('refuses a backend the Endpoint already routes to', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpointWith([backend('orders', 'api')])),
      );

      await expect(
        service.addEndpointBackend({
          ...ref,
          component: 'orders',
          workloadEndpoint: 'api',
        }),
      ).rejects.toThrow('already routes to orders/api');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('refuses more than 16 backends', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith(
            Array.from({ length: 16 }, (_, i) => backend(`c${i}`, 'api')),
          ),
        ),
      );

      await expect(
        service.addEndpointBackend({
          ...ref,
          component: 'payments',
          workloadEndpoint: 'http',
        }),
      ).rejects.toThrow('maximum of 16 backends');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('reports a failed update', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpointWith([backend('orders', 'api')])),
      );
      mockPUT.mockResolvedValue(createErrorResponse(403, 'forbidden'));

      await expect(
        service.addEndpointBackend({
          ...ref,
          component: 'payments',
          workloadEndpoint: 'http',
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateEndpointBackendWeight', () => {
    it("sets one backend's weight", async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith([backend('orders', 'api'), backend('payments', 'http')]),
        ),
      );

      await service.updateEndpointBackendWeight({
        ...ref,
        backendName: 'payments-http',
        weight: 0,
      });

      expect(sentBody().spec.backendRefs).toEqual([
        backend('orders', 'api'),
        backend('payments', 'http', 0),
      ]);
    });

    it('refuses a backend the Endpoint does not have', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpointWith([backend('orders', 'api')])),
      );

      await expect(
        service.updateEndpointBackendWeight({
          ...ref,
          backendName: 'missing',
          weight: 2,
        }),
      ).rejects.toThrow('has no backend missing');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('refuses weights that send no traffic', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith([
            backend('orders', 'api'),
            backend('payments', 'http', 0),
          ]),
        ),
      );

      await expect(
        service.updateEndpointBackendWeight({
          ...ref,
          backendName: 'orders-api',
          weight: 0,
        }),
      ).rejects.toThrow('needs a weight above 0');
      expect(mockPUT).not.toHaveBeenCalled();
    });
  });

  describe('removeEndpointBackend', () => {
    it('removes one backend', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith([backend('orders', 'api'), backend('payments', 'http')]),
        ),
      );

      await service.removeEndpointBackend({
        ...ref,
        backendName: 'orders-api',
      });

      expect(sentBody().spec.backendRefs).toEqual([
        backend('payments', 'http'),
      ]);
    });

    it('refuses to remove the last backend', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpointWith([backend('orders', 'api')])),
      );

      await expect(
        service.removeEndpointBackend({ ...ref, backendName: 'orders-api' }),
      ).rejects.toThrow('needs at least one backend');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('refuses to leave only backends with weight 0', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(
          endpointWith([
            backend('orders', 'api'),
            backend('payments', 'http', 0),
          ]),
        ),
      );

      await expect(
        service.removeEndpointBackend({ ...ref, backendName: 'orders-api' }),
      ).rejects.toThrow('needs a weight above 0');
      expect(mockPUT).not.toHaveBeenCalled();
    });
  });
});
