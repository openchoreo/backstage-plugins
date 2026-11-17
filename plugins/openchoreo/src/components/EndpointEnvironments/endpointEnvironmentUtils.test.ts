import {
  computeEndpointReleaseDrift,
  countResolvedBackends,
  deriveEndpointEnvBadgeStatus,
  formatServiceURL,
  resolveDefaultEndpointSelection,
} from './endpointEnvironmentUtils';

describe('resolveDefaultEndpointSelection', () => {
  const env = (name: string, status?: 'Ready' | 'NotReady' | 'Failed') => ({
    name,
    ...(status && { bindingName: `${name}-binding`, status }),
  });

  it('selects nothing when there are no environments', () => {
    expect(resolveDefaultEndpointSelection([])).toBeNull();
  });

  it('selects Set up when the Endpoint is deployed nowhere', () => {
    expect(resolveDefaultEndpointSelection([env('dev'), env('prod')])).toEqual({
      kind: 'setup',
    });
  });

  it('selects the lowest environment it is deployed to', () => {
    expect(
      resolveDefaultEndpointSelection([
        env('dev'),
        env('staging', 'Ready'),
        env('prod', 'Ready'),
      ]),
    ).toEqual({ kind: 'env', name: 'staging' });
  });

  it('prefers a running or rolling-out deployment to a failed one', () => {
    expect(
      resolveDefaultEndpointSelection([
        env('dev', 'Failed'),
        env('staging', 'NotReady'),
      ]),
    ).toEqual({ kind: 'env', name: 'staging' });
    expect(
      resolveDefaultEndpointSelection([env('dev'), env('staging', 'Failed')]),
    ).toEqual({ kind: 'env', name: 'staging' });
  });

  it('selects a deployment whose status is unknown over Set up', () => {
    expect(
      resolveDefaultEndpointSelection([
        env('dev'),
        { name: 'staging', bindingName: 'staging-binding' },
      ]),
    ).toEqual({ kind: 'env', name: 'staging' });
  });
});

describe('deriveEndpointEnvBadgeStatus', () => {
  it('reports not-deployed without a binding, else the binding status', () => {
    expect(deriveEndpointEnvBadgeStatus({ name: 'dev' })).toBe('not-deployed');
    expect(
      deriveEndpointEnvBadgeStatus({
        name: 'dev',
        bindingName: 'b',
        status: 'Ready',
      }),
    ).toBe('active');
    expect(
      deriveEndpointEnvBadgeStatus({
        name: 'dev',
        bindingName: 'b',
        status: 'NotReady',
      }),
    ).toBe('pending');
    expect(
      deriveEndpointEnvBadgeStatus({
        name: 'dev',
        bindingName: 'b',
        status: 'Failed',
      }),
    ).toBe('failed');
  });
});

describe('computeEndpointReleaseDrift', () => {
  const dev = {
    name: 'dev',
    endpointRelease: 'r2',
    promotionTargets: [{ name: 'prod' }],
  };

  it('flags an environment behind its upstream', () => {
    const prod = { name: 'prod', endpointRelease: 'r1' };
    expect(computeEndpointReleaseDrift(prod, [dev, prod])).toEqual({
      isBehind: true,
      aheadUpstreams: [{ envName: 'dev', releaseName: 'r2' }],
    });
  });

  it('does not flag an environment in sync or without a release', () => {
    expect(
      computeEndpointReleaseDrift({ name: 'prod', endpointRelease: 'r2' }, [
        dev,
      ]).isBehind,
    ).toBe(false);
    expect(computeEndpointReleaseDrift({ name: 'prod' }, [dev]).isBehind).toBe(
      false,
    );
  });
});

describe('formatServiceURL', () => {
  it('joins scheme, host, port and path', () => {
    expect(
      formatServiceURL({
        scheme: 'http',
        host: 'orders.dp.svc',
        port: 8080,
        path: '/api',
      }),
    ).toBe('http://orders.dp.svc:8080/api');
  });

  it('returns undefined without a host', () => {
    expect(formatServiceURL(undefined)).toBeUndefined();
    expect(formatServiceURL({ port: 80 })).toBeUndefined();
  });
});

describe('countResolvedBackends', () => {
  it('counts resolved backends', () => {
    expect(
      countResolvedBackends({
        name: 'dev',
        backends: [
          { name: 'a', kind: 'Component', resolved: true },
          { name: 'b', kind: 'Component', resolved: false },
        ],
      }),
    ).toEqual({ resolved: 1, total: 2 });
  });
});
