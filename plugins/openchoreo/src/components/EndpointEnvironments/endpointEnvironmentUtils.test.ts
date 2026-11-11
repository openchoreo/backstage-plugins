import {
  computeEndpointReleaseDrift,
  countResolvedBackends,
  deriveEndpointEnvBadgeStatus,
  formatServiceURL,
} from './endpointEnvironmentUtils';

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
