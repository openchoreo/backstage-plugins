import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { EndpointInfoService } from './EndpointInfoService';

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockPUT = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PUT: mockPUT,
    DELETE: mockDELETE,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

const ref = {
  componentName: 'orders',
  projectName: 'store',
  namespaceName: 'acme',
};

function endpoint(
  name: string,
  overrides: {
    component?: string;
    workloadEndpoint?: string;
    projectName?: string;
    parameters?: Record<string, unknown>;
    releaseLine?: string;
  } = {},
) {
  const line = overrides.releaseLine;
  const component = overrides.component ?? 'orders';
  const workloadEndpoint = overrides.workloadEndpoint ?? 'api';
  return {
    metadata: { name, resourceVersion: '7' },
    spec: {
      // The API keeps the owner on orders only while every backend routes to
      // it, so a backend on another component leaves the project the owner.
      owner: {
        projectName: overrides.projectName ?? 'store',
        ...(component === 'orders' && { componentName: 'orders' }),
        ...(component === 'orders' && line && { releaseLineName: line }),
      },
      type: { kind: 'ClusterEndpointType', name: 'http-route' },
      visibility: ['external'],
      backendRefs: [
        {
          name: [component, line, workloadEndpoint].filter(Boolean).join('-'),
          kind: 'Component',
          weight: 1,
          component: {
            name: component,
            endpoint: workloadEndpoint,
            ...(line ? { releaseLine: line } : {}),
          } as { name: string; endpoint: string; releaseLine?: string },
        },
      ],
      ...(overrides.parameters && { parameters: overrides.parameters }),
      autoDeploy: true,
    },
    status: {
      conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
      latestRelease: { name: `${name}-abc`, hash: 'abc' },
    },
  };
}

describe('EndpointInfoService component Endpoints', () => {
  let service: EndpointInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EndpointInfoService(mockServices.logger.mock(), 'http://api');
  });

  describe('fetchComponentEndpoints', () => {
    it('returns the Endpoints the component owns and allowedEndpoints', async () => {
      const allowed = [
        {
          protocols: ['HTTP'],
          visibilities: ['external'],
          ref: { kind: 'ClusterEndpointType', name: 'http-route' },
          default: true,
        },
      ];
      mockGET.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith('/endpoints')
            ? createOkResponse({
                items: [
                  endpoint('orders-api', { parameters: { host: 'a' } }),
                  // Routes to another component: owned by the project.
                  endpoint('orders-shared', { component: 'payments' }),
                ],
              })
            : createOkResponse({ spec: { allowedEndpoints: allowed } }),
        ),
      );

      const result = await service.fetchComponentEndpoints({
        ...ref,
        componentTypeKind: 'ClusterComponentType',
        componentTypeName: 'service',
      });

      expect(result.allowedEndpoints).toEqual(allowed);
      expect(result.legacyEndpoints).toBe(false);
      expect(result.endpoints).toEqual([
        {
          name: 'orders-api',
          releaseLine: '',
          workloadEndpoint: 'api',
          typeKind: 'ClusterEndpointType',
          typeName: 'http-route',
          visibility: ['external'],
          parameters: { host: 'a' },
          autoDeploy: true,
          ready: { status: 'True', reason: 'Ready', message: undefined },
          latestRelease: 'orders-api-abc',
        },
      ]);
      expect(mockGET).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/endpoints',
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({ project: 'store' }),
          }),
        }),
      );
      expect(mockGET).toHaveBeenCalledWith(
        '/api/v1/clustercomponenttypes/{cctName}',
        { params: { path: { cctName: 'service' } } },
      );
    });

    it('fails when the ComponentType cannot be read', async () => {
      mockGET.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith('/endpoints')
            ? createOkResponse({ items: [endpoint('orders-api')] })
            : createErrorResponse(404, 'not found'),
        ),
      );

      await expect(
        service.fetchComponentEndpoints({
          ...ref,
          componentTypeKind: 'ComponentType',
          componentTypeName: 'service',
        }),
      ).rejects.toThrow();
    });

    it('reports a ComponentType kept on legacy endpoints', async () => {
      mockGET.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith('/endpoints')
            ? createOkResponse({ items: [] })
            : createOkResponse({
                metadata: {
                  name: 'service',
                  annotations: { 'openchoreo.dev/legacy-endpoints': 'true' },
                },
                spec: {},
              }),
        ),
      );

      const result = await service.fetchComponentEndpoints({
        ...ref,
        componentTypeKind: 'ComponentType',
        componentTypeName: 'service',
      });

      expect(result).toEqual({
        endpoints: [],
        allowedEndpoints: [],
        legacyEndpoints: true,
      });
    });

    it("keeps the main line's and a release line's Endpoints apart", async () => {
      mockGET.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith('/endpoints')
            ? createOkResponse({
                items: [
                  endpoint('orders-api'),
                  endpoint('orders-next-api', { releaseLine: 'next' }),
                ],
              })
            : createOkResponse({ spec: {} }),
        ),
      );
      const fetch = (releaseLine?: string) =>
        service.fetchComponentEndpoints({
          ...ref,
          releaseLine,
          componentTypeKind: 'ClusterComponentType',
          componentTypeName: 'service',
        });

      expect((await fetch()).endpoints.map(e => e.name)).toEqual([
        'orders-api',
      ]);
      expect((await fetch('main')).endpoints.map(e => e.name)).toEqual([
        'orders-api',
      ]);
      const line = await fetch('next');
      expect(line.endpoints.map(e => [e.name, e.releaseLine])).toEqual([
        ['orders-next-api', 'next'],
      ]);
    });
  });

  describe('fetchReleaseLineEndpointDrafts', () => {
    const lineRef = { ...ref, releaseLine: 'next', autoDeploy: true };

    it("drafts the line's copies of the main line's Endpoints", async () => {
      mockGET.mockResolvedValue(
        createOkResponse({
          items: [endpoint('orders-api', { parameters: { pathPrefix: '/x' } })],
        }),
      );

      expect(await service.fetchReleaseLineEndpointDrafts(lineRef)).toEqual([
        {
          name: 'orders-next-api',
          componentName: 'orders',
          projectName: 'store',
          releaseLine: 'next',
          workloadEndpoint: 'api',
          typeKind: 'ClusterEndpointType',
          typeName: 'http-route',
          visibility: ['external'],
          parameters: { pathPrefix: '/x' },
          autoDeploy: true,
        },
      ]);
      expect(mockPOST).not.toHaveBeenCalled();
    });

    it('leaves out Endpoints the line already has', async () => {
      mockGET.mockResolvedValue(
        createOkResponse({
          items: [
            endpoint('orders-api'),
            endpoint('orders-next-api', { releaseLine: 'next' }),
          ],
        }),
      );

      expect(await service.fetchReleaseLineEndpointDrafts(lineRef)).toEqual([]);
    });

    it('refuses the main line', async () => {
      await expect(
        service.fetchReleaseLineEndpointDrafts({
          ...lineRef,
          releaseLine: 'main',
        }),
      ).rejects.toThrow(/not main/);
    });
  });

  describe('createComponentEndpoint', () => {
    const request = {
      ...ref,
      workloadEndpoint: 'api',
      typeKind: 'ClusterEndpointType' as const,
      typeName: 'managed-http',
      visibility: ['external'],
      parameters: { requireApiKey: true },
      autoDeploy: false,
    };

    it('creates an Endpoint the component owns, named after the workload endpoint', async () => {
      mockPOST.mockResolvedValue(createOkResponse({}));

      await expect(service.createComponentEndpoint(request)).resolves.toEqual({
        name: 'orders-api',
      });
      expect(mockPOST).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/endpoints',
        {
          params: { path: { namespaceName: 'acme' } },
          body: expect.objectContaining({
            metadata: { name: 'orders-api' },
            spec: expect.objectContaining({
              owner: { projectName: 'store', componentName: 'orders' },
              type: { kind: 'ClusterEndpointType', name: 'managed-http' },
              parameters: { requireApiKey: true },
              autoDeploy: false,
            }),
          }),
        },
      );
    });

    it('appends the EndpointType when the plain name is taken', async () => {
      mockPOST
        .mockResolvedValueOnce(createErrorResponse(409, 'exists'))
        .mockResolvedValueOnce(createOkResponse({}));

      await expect(service.createComponentEndpoint(request)).resolves.toEqual({
        name: 'orders-api-managed-http',
      });
    });

    it("names, owns and routes a release line's Endpoint for the line", async () => {
      mockPOST.mockResolvedValue(createOkResponse({}));

      await expect(
        service.createComponentEndpoint({ ...request, releaseLine: 'next' }),
      ).resolves.toEqual({ name: 'orders-next-api' });
      const body = mockPOST.mock.calls[0][1].body;
      expect(body.spec.owner).toEqual({
        projectName: 'store',
        componentName: 'orders',
        releaseLineName: 'next',
      });
      expect(body.spec.backendRefs).toEqual([
        {
          name: 'orders-next-api',
          kind: 'Component',
          component: { name: 'orders', endpoint: 'api', releaseLine: 'next' },
        },
      ]);
    });

    it('fails when both names are taken', async () => {
      mockPOST.mockResolvedValue(createErrorResponse(409, 'exists'));

      await expect(service.createComponentEndpoint(request)).rejects.toThrow();
      expect(mockPOST).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateComponentEndpoint', () => {
    it('replaces visibility and parameters, keeping the rest', async () => {
      const current = endpoint('orders-api', { parameters: { host: 'a' } });
      mockGET.mockResolvedValue(createOkResponse(current));
      mockPUT.mockImplementation((_path: string, { body }: any) =>
        Promise.resolve(createOkResponse(body)),
      );

      const saved = await service.updateComponentEndpoint({
        ...ref,
        endpointName: 'orders-api',
        visibility: ['external', 'internal'],
        parameters: {},
      });

      const body = mockPUT.mock.calls[0][1].body;
      expect(body).not.toHaveProperty('status');
      expect(body.metadata).toEqual(current.metadata);
      expect(body.spec).toEqual({
        ...current.spec,
        visibility: ['external', 'internal'],
        parameters: undefined,
      });
      expect(body.spec).not.toHaveProperty('parameters');
      expect(saved.visibility).toEqual(['external', 'internal']);
    });

    it('follows a renamed workload endpoint', async () => {
      mockGET.mockResolvedValue(createOkResponse(endpoint('orders-api')));
      mockPUT.mockImplementation((_path: string, { body }: any) =>
        Promise.resolve(createOkResponse(body)),
      );

      const saved = await service.updateComponentEndpoint({
        ...ref,
        endpointName: 'orders-api',
        visibility: ['external'],
        workloadEndpoint: 'http',
      });

      const body = mockPUT.mock.calls[0][1].body;
      expect(body.spec.backendRefs).toEqual([
        {
          name: 'orders-api',
          kind: 'Component',
          weight: 1,
          component: { name: 'orders', endpoint: 'http' },
        },
      ]);
      expect(saved.workloadEndpoint).toBe('http');
    });

    it("leaves another line's backend on its name when renaming", async () => {
      const canary = endpoint('orders-api');
      canary.spec.backendRefs = [
        {
          name: 'orders-next-api',
          kind: 'Component',
          weight: 1,
          component: { name: 'orders', endpoint: 'api', releaseLine: 'next' },
        },
        ...canary.spec.backendRefs,
      ];
      mockGET.mockResolvedValue(createOkResponse(canary));
      mockPUT.mockImplementation((_path: string, { body }: any) =>
        Promise.resolve(createOkResponse(body)),
      );

      const saved = await service.updateComponentEndpoint({
        ...ref,
        endpointName: 'orders-api',
        visibility: ['external'],
        workloadEndpoint: 'http',
      });

      const body = mockPUT.mock.calls[0][1].body;
      expect(
        body.spec.backendRefs.map((r: any) => [
          r.component.releaseLine,
          r.component.endpoint,
        ]),
      ).toEqual([
        ['next', 'api'],
        [undefined, 'http'],
      ]);
      expect(saved.workloadEndpoint).toBe('http');
    });

    it("refuses an Endpoint the component doesn't own", async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpoint('orders-api', { component: 'payments' })),
      );

      await expect(
        service.updateComponentEndpoint({
          ...ref,
          endpointName: 'orders-api',
          visibility: ['external'],
        }),
      ).rejects.toThrow(/not owned by component orders/);
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it("refuses a release line's Endpoint from the main line's page", async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpoint('orders-next-api', { releaseLine: 'next' })),
      );

      await expect(
        service.updateComponentEndpoint({
          ...ref,
          endpointName: 'orders-next-api',
          visibility: ['external'],
        }),
      ).rejects.toThrow(
        /belongs to release line next of component orders, not component orders/,
      );
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it("refuses the main line's Endpoint from a release line's page", async () => {
      mockGET.mockResolvedValue(createOkResponse(endpoint('orders-api')));

      await expect(
        service.updateComponentEndpoint({
          ...ref,
          releaseLine: 'next',
          endpointName: 'orders-api',
          visibility: ['external'],
          parameters: { pathPrefix: '/orders-next' },
        }),
      ).rejects.toThrow(
        /belongs to component orders, not release line next of component orders/,
      );
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it("updates a release line's Endpoint from its page", async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpoint('orders-next-api', { releaseLine: 'next' })),
      );
      mockPUT.mockImplementation((_path: string, { body }: any) =>
        Promise.resolve(createOkResponse(body)),
      );

      const saved = await service.updateComponentEndpoint({
        ...ref,
        releaseLine: 'next',
        endpointName: 'orders-next-api',
        visibility: ['internal'],
      });
      expect(saved.visibility).toEqual(['internal']);
      expect(saved.releaseLine).toBe('next');
    });

    it('refuses an empty visibility', async () => {
      await expect(
        service.updateComponentEndpoint({
          ...ref,
          endpointName: 'orders-api',
          visibility: [],
        }),
      ).rejects.toThrow(/at least one visibility/);
      expect(mockGET).not.toHaveBeenCalled();
    });
  });

  describe('deleteComponentEndpoint', () => {
    it('deletes an Endpoint the component owns', async () => {
      mockGET.mockResolvedValue(createOkResponse(endpoint('orders-api')));
      mockDELETE.mockResolvedValue(createOkResponse(undefined));

      await service.deleteComponentEndpoint({
        ...ref,
        endpointName: 'orders-api',
      });

      expect(mockDELETE).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}',
        {
          params: {
            path: { namespaceName: 'acme', endpointName: 'orders-api' },
          },
        },
      );
    });

    it("refuses another line's Endpoint", async () => {
      mockGET.mockResolvedValue(createOkResponse(endpoint('orders-api')));

      await expect(
        service.deleteComponentEndpoint({
          ...ref,
          releaseLine: 'next',
          endpointName: 'orders-api',
        }),
      ).rejects.toThrow(/belongs to component orders/);
      expect(mockDELETE).not.toHaveBeenCalled();
    });

    it('refuses an Endpoint of another project', async () => {
      mockGET.mockResolvedValue(
        createOkResponse(endpoint('orders-api', { projectName: 'other' })),
      );

      await expect(
        service.deleteComponentEndpoint({ ...ref, endpointName: 'orders-api' }),
      ).rejects.toThrow(/not owned/);
      expect(mockDELETE).not.toHaveBeenCalled();
    });
  });
});
