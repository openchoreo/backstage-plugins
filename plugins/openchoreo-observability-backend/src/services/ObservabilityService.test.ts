import { mockServices } from '@backstage/backend-test-utils';
import { ObservabilityService } from './ObservabilityService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
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
