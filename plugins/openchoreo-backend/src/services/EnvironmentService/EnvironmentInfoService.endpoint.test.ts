import { mockServices } from '@backstage/backend-test-utils';
import { NotFoundError } from '@backstage/errors';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import {
  EnvironmentInfoService,
  PipelineUnavailableError,
} from './EnvironmentInfoService';

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

const NS = 'acme';
const target = {
  endpointName: 'orders-api',
  projectName: 'store',
  namespaceName: NS,
};

function binding(
  name: string,
  environment: string,
  overrides: { projectName?: string; status?: any } = {},
) {
  return {
    metadata: {
      name,
      namespace: NS,
      creationTimestamp: '2026-10-19T09:00:00Z',
    },
    spec: {
      owner: {
        projectName: overrides.projectName ?? 'store',
        endpointName: 'orders-api',
      },
      environment,
      endpointRelease: 'orders-api-abc',
      endpointTypeEnvironmentConfigs: { hostname: 'orders.dev.example.com' },
    },
    status: overrides.status,
  };
}

function environmentResource(name: string) {
  return {
    metadata: { name, namespace: NS, uid: `${name}-uid` },
    spec: { dataPlaneRef: { kind: 'DataPlane', name: 'default' } },
  };
}

/**
 * Routes GETs by API path so the parallel calls in the env-info join do
 * not depend on call order.
 */
function routeGets(routes: Record<string, unknown>) {
  mockGET.mockImplementation((path: string) => {
    if (!(path in routes)) {
      return Promise.resolve(createErrorResponse(404));
    }
    return Promise.resolve(createOkResponse(routes[path]));
  });
}

const BINDINGS = '/api/v1/namespaces/{namespaceName}/endpointreleasebindings';

function createService() {
  return EnvironmentInfoService.create(
    mockServices.logger.mock(),
    'http://test:8080',
  );
}

describe('EnvironmentInfoService endpoint bindings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchEndpointReleaseBindings', () => {
    it("filters out other projects' bindings for a same-named endpoint", async () => {
      routeGets({
        [BINDINGS]: {
          items: [
            binding('orders-api-dev', 'dev'),
            binding('orders-api-dev-other', 'dev', { projectName: 'other' }),
          ],
        },
      });

      const result = await createService().fetchEndpointReleaseBindings(
        target,
        'token',
      );

      expect(result.items.map(b => b.metadata?.name)).toEqual([
        'orders-api-dev',
      ]);
      expect(mockGET).toHaveBeenCalledWith(BINDINGS, {
        params: {
          path: { namespaceName: NS },
          query: { endpoint: 'orders-api', limit: 100, cursor: undefined },
        },
      });
    });
  });

  describe('updateEndpointReleaseBinding', () => {
    it('updates the binding pinned to the environment, whatever its name', async () => {
      // Created outside the portal, so it does not follow <endpoint>-<env>.
      routeGets({
        [BINDINGS]: { items: [binding('orders-dev-by-occ', 'dev')] },
      });
      mockPUT.mockResolvedValue(createOkResponse({}));

      await createService().updateEndpointReleaseBinding(
        { ...target, environment: 'dev', releaseName: 'orders-api-def' },
        'token',
      );

      expect(mockPOST).not.toHaveBeenCalled();
      const [path, opts] = mockPUT.mock.calls[0];
      expect(path).toBe(`${BINDINGS}/{endpointReleaseBindingName}`);
      expect(opts.params.path.endpointReleaseBindingName).toBe(
        'orders-dev-by-occ',
      );
      // The release moves; owner, environment and overrides are kept.
      expect(opts.body.spec).toEqual({
        owner: { projectName: 'store', endpointName: 'orders-api' },
        environment: 'dev',
        endpointRelease: 'orders-api-def',
        endpointTypeEnvironmentConfigs: {
          hostname: 'orders.dev.example.com',
        },
      });
    });

    it('keeps the pinned release when only overrides are saved', async () => {
      routeGets({ [BINDINGS]: { items: [binding('orders-api-dev', 'dev')] } });
      mockPUT.mockResolvedValue(createOkResponse({}));

      await createService().updateEndpointReleaseBinding(
        {
          ...target,
          environment: 'dev',
          endpointTypeEnvironmentConfigs: { hostname: 'new.example.com' },
        },
        'token',
      );

      expect(mockPUT.mock.calls[0][1].body.spec).toMatchObject({
        endpointRelease: 'orders-api-abc',
        endpointTypeEnvironmentConfigs: { hostname: 'new.example.com' },
      });
    });

    it('creates <endpoint>-<environment> when the environment has no binding', async () => {
      routeGets({ [BINDINGS]: { items: [binding('orders-api-dev', 'dev')] } });
      mockPOST.mockResolvedValue(createOkResponse({}));

      await createService().updateEndpointReleaseBinding(
        { ...target, environment: 'staging', releaseName: 'orders-api-abc' },
        'token',
      );

      expect(mockPUT).not.toHaveBeenCalled();
      expect(mockPOST).toHaveBeenCalledWith(BINDINGS, {
        params: { path: { namespaceName: NS } },
        body: {
          metadata: { name: 'orders-api-staging', namespace: NS },
          spec: {
            owner: { projectName: 'store', endpointName: 'orders-api' },
            environment: 'staging',
            endpointRelease: 'orders-api-abc',
          },
        },
      });
    });
  });

  describe('deleteEndpointReleaseBinding', () => {
    it('deletes the binding pinned to the environment', async () => {
      routeGets({
        [BINDINGS]: { items: [binding('orders-dev-by-occ', 'dev')] },
      });
      mockDELETE.mockResolvedValue(createOkResponse(undefined));

      const result = await createService().deleteEndpointReleaseBinding(
        { ...target, environment: 'dev' },
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(mockDELETE.mock.calls[0][1].params.path).toEqual({
        namespaceName: NS,
        endpointReleaseBindingName: 'orders-dev-by-occ',
      });
    });

    it('fails with NotFoundError when the environment has no binding', async () => {
      routeGets({ [BINDINGS]: { items: [] } });

      await expect(
        createService().deleteEndpointReleaseBinding(
          { ...target, environment: 'dev' },
          'token',
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(mockDELETE).not.toHaveBeenCalled();
    });
  });

  describe('fetchEndpointEnvironmentInfo', () => {
    const baseRoutes = {
      '/api/v1/namespaces/{namespaceName}/environments': {
        items: [environmentResource('staging'), environmentResource('dev')],
      },
      '/api/v1/namespaces/{namespaceName}/projects/{projectName}': {
        metadata: { name: 'store', namespace: NS },
        spec: { deploymentPipelineRef: { name: 'default' } },
      },
      '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}':
        {
          metadata: { name: 'default', namespace: NS },
          spec: {
            promotionPaths: [
              {
                sourceEnvironmentRef: 'dev',
                targetEnvironmentRefs: [{ name: 'staging' }],
              },
            ],
          },
        },
      '/api/v1/namespaces/{namespaceName}/endpoints/{endpointName}': {
        metadata: { name: 'orders-api', namespace: NS },
        status: { latestRelease: { name: 'orders-api-def', hash: 'def' } },
      },
    };

    it('orders environments by the pipeline and reports backend resolution', async () => {
      routeGets({
        ...baseRoutes,
        [BINDINGS]: {
          items: [
            binding('orders-api-dev', 'dev', {
              status: {
                conditions: [
                  {
                    type: 'Ready',
                    status: 'True',
                    reason: 'Ready',
                    lastTransitionTime: '2026-10-19T10:00:00Z',
                  },
                ],
                backends: [
                  {
                    name: 'primary',
                    kind: 'Component',
                    weight: 100,
                    resolved: true,
                    serviceURL: {
                      scheme: 'http',
                      host: 'orders.dp.svc',
                      port: 8080,
                    },
                  },
                  {
                    name: 'canary',
                    kind: 'Component',
                    weight: 0,
                    resolved: false,
                    reason: 'BackendNotDeployed',
                  },
                ],
              },
            }),
          ],
        },
      });

      const result = await createService().fetchEndpointEnvironmentInfo(
        target,
        'token',
      );

      expect(result.map(e => e.name)).toEqual(['dev', 'staging']);
      const [dev, staging] = result;
      expect(dev).toMatchObject({
        bindingName: 'orders-api-dev',
        endpointRelease: 'orders-api-abc',
        latestRelease: 'orders-api-def',
        status: 'Ready',
        lastDeployed: '2026-10-19T10:00:00Z',
        endpointTypeEnvironmentConfigs: {
          hostname: 'orders.dev.example.com',
        },
        promotionTargets: [{ name: 'staging', resourceName: 'staging' }],
      });
      expect(dev.backends).toEqual([
        expect.objectContaining({ name: 'primary', resolved: true }),
        expect.objectContaining({
          name: 'canary',
          resolved: false,
          reason: 'BackendNotDeployed',
        }),
      ]);
      // An environment with no binding still appears, so it can be deployed to.
      expect(staging).toEqual(
        expect.objectContaining({
          name: 'staging',
          latestRelease: 'orders-api-def',
        }),
      );
      expect(staging.bindingName).toBeUndefined();
    });

    it('fails when the project has no deployment pipeline', async () => {
      routeGets({
        ...baseRoutes,
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}': {
          metadata: { name: 'store', namespace: NS },
          spec: {},
        },
        [BINDINGS]: { items: [] },
      });

      await expect(
        createService().fetchEndpointEnvironmentInfo(target, 'token'),
      ).rejects.toBeInstanceOf(PipelineUnavailableError);
    });
  });
});
