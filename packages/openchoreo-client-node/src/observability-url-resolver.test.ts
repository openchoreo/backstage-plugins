import { ObservabilityUrlResolver } from './observability-url-resolver';

const get = jest.fn();

jest.mock('./factory', () => ({
  createOpenChoreoApiClient: () => ({ GET: get }),
}));

const ok = (data: unknown) => ({
  data,
  error: undefined,
  response: { ok: true, status: 200, statusText: 'OK' },
});

const notFound = () => ({
  data: undefined,
  error: { message: 'not found' },
  response: { ok: false, status: 404, statusText: 'Not Found' },
});

describe('ObservabilityUrlResolver.resolveForPlatform', () => {
  let resolver: ObservabilityUrlResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new ObservabilityUrlResolver({ baseUrl: 'http://api' });
  });

  it('reads the cluster-scoped plane named default', async () => {
    get.mockResolvedValueOnce(
      ok({ spec: { observerURL: 'http://observer:11080' } }),
    );

    await expect(resolver.resolveForPlatform()).resolves.toEqual({
      observerUrl: 'http://observer:11080',
      rcaAgentUrl: undefined,
      finopsAgentUrl: undefined,
    });

    expect(get).toHaveBeenCalledWith(
      '/api/v1/clusterobservabilityplanes/{clusterObservabilityPlaneName}',
      { params: { path: { clusterObservabilityPlaneName: 'default' } } },
    );
  });

  it('falls back to the namespaced plane when there is no cluster-scoped one', async () => {
    get
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(
        ok({ spec: { observerURL: 'http://ns-observer:11080' } }),
      );

    await expect(resolver.resolveForPlatform()).resolves.toMatchObject({
      observerUrl: 'http://ns-observer:11080',
    });

    expect(get).toHaveBeenLastCalledWith(
      '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}',
      {
        params: {
          path: { namespaceName: 'default', observabilityPlaneName: 'default' },
        },
      },
    );
  });

  it('returns nothing when neither plane exists', async () => {
    get.mockResolvedValue(notFound());

    await expect(resolver.resolveForPlatform()).resolves.toEqual({});
  });

  it('caches a resolved URL rather than walking the chain per query', async () => {
    get.mockResolvedValueOnce(
      ok({ spec: { observerURL: 'http://observer:11080' } }),
    );

    await resolver.resolveForPlatform();
    await resolver.resolveForPlatform();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not cache an unresolved lookup, so a later install is picked up', async () => {
    get.mockResolvedValue(notFound());

    await resolver.resolveForPlatform();
    await resolver.resolveForPlatform();

    // Two lookups per call: cluster-scoped, then namespaced.
    expect(get).toHaveBeenCalledTimes(4);
  });
});
