import { mockServices } from '@backstage/backend-test-utils';
import { ObservabilityService } from './ObservabilityService';

const mockGET = jest.fn();
const mockPUT = jest.fn();
const mockCreateClient = jest.fn(() => ({ GET: mockGET, PUT: mockPUT }));

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: (...args: unknown[]) =>
    (mockCreateClient as any)(...args),
}));

const createOkResponse = <T>(data: T) => ({
  data,
  error: undefined,
  response: { ok: true as const, status: 200 },
});

const logger = mockServices.logger.mock();

describe('ObservabilityService.fetchDataPlaneNetPolProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const service = ObservabilityService.create(logger, 'http://test:8080');

  const makeDataPlane = (provider?: string) => ({
    metadata: {
      name: 'dp-1',
      namespace: 'ns-1',
      annotations: provider
        ? { 'openchoreo.dev/networkpolicyprovider': provider }
        : {},
    },
    spec: {},
  });

  it('returns the annotation value for a DataPlane', async () => {
    mockGET.mockResolvedValueOnce(createOkResponse(makeDataPlane('cilium')));

    const result = await service.fetchDataPlaneNetPolProvider(
      'ns-1',
      'DataPlane',
      'dp-1',
    );

    expect(result).toBe('cilium');
    expect(mockGET).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
      { params: { path: { namespaceName: 'ns-1', dpName: 'dp-1' } } },
    );
  });

  it('returns the annotation value for a ClusterDataPlane', async () => {
    mockGET.mockResolvedValueOnce(createOkResponse(makeDataPlane('cilium')));

    const result = await service.fetchDataPlaneNetPolProvider(
      'ns-1',
      'ClusterDataPlane',
      'cdp-1',
    );

    expect(result).toBe('cilium');
    expect(mockGET).toHaveBeenCalledWith(
      '/api/v1/clusterdataplanes/{cdpName}',
      { params: { path: { cdpName: 'cdp-1' } } },
    );
  });

  it('returns undefined when annotation is absent', async () => {
    mockGET.mockResolvedValueOnce(createOkResponse(makeDataPlane()));

    const result = await service.fetchDataPlaneNetPolProvider(
      'ns-1',
      'DataPlane',
      'dp-1',
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined and logs when the API call throws', async () => {
    mockGET.mockRejectedValueOnce(new Error('network error'));

    const result = await service.fetchDataPlaneNetPolProvider(
      'ns-1',
      'DataPlane',
      'dp-1',
    );

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns undefined and warns for an invalid dpKind', async () => {
    const result = await service.fetchDataPlaneNetPolProvider(
      'ns-1',
      'InvalidKind',
      'dp-1',
    );

    expect(result).toBeUndefined();
    expect(mockGET).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('ObservabilityService release binding methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseUrl =
    'http://openchoreo-api.openchoreo-control-plane.svc.cluster.local:8080/api/v1';
  const service = ObservabilityService.create(logger, baseUrl);

  const COMPONENT_PATH =
    '/api/v1/namespaces/{namespaceName}/releasebindings/{releaseBindingName}';
  const RESOURCE_PATH =
    '/api/v1/namespaces/{namespaceName}/resourcereleasebindings/{resourceReleaseBindingName}';

  it('reads a component release binding', async () => {
    mockGET.mockResolvedValueOnce(
      createOkResponse({ metadata: { name: 'rb' } }),
    );

    await service.getReleaseBinding('ns-1', 'rb', 'user-token');

    expect(mockGET).toHaveBeenCalledWith(COMPONENT_PATH, {
      params: { path: { namespaceName: 'ns-1', releaseBindingName: 'rb' } },
    });
  });

  it('reads a resource release binding from its own endpoint', async () => {
    mockGET.mockResolvedValueOnce(
      createOkResponse({ metadata: { name: 'rrb' } }),
    );

    await service.getResourceReleaseBinding('ns-1', 'rrb', 'user-token');

    expect(mockGET).toHaveBeenCalledWith(RESOURCE_PATH, {
      params: {
        path: { namespaceName: 'ns-1', resourceReleaseBindingName: 'rrb' },
      },
    });
  });

  it('writes a resource release binding with the full spec', async () => {
    const body = {
      spec: { resourceTypeEnvironmentConfigs: { size: 'large' } },
    };
    mockPUT.mockResolvedValueOnce(createOkResponse(body));

    await service.updateResourceReleaseBinding(
      'ns-1',
      'rrb',
      body,
      'user-token',
    );

    expect(mockPUT).toHaveBeenCalledWith(RESOURCE_PATH, {
      params: {
        path: { namespaceName: 'ns-1', resourceReleaseBindingName: 'rrb' },
      },
      body,
    });
  });

  it('forwards the caller token so the API can authorize the write', async () => {
    mockPUT.mockResolvedValueOnce(createOkResponse({}));

    await service.updateResourceReleaseBinding('ns-1', 'rrb', {}, 'user-token');

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl, token: 'user-token' }),
    );
  });

  it('omits the token when the caller has none', async () => {
    mockGET.mockResolvedValueOnce(createOkResponse({}));

    await service.getResourceReleaseBinding('ns-1', 'rrb', undefined);

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl, token: undefined }),
    );
  });
});
