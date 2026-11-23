import {
  checkPromotion,
  planEndpointFollow,
  promotionBlockedMessage,
  type FollowingEndpoint,
} from './endpointFollow';

const endpoint = (
  name: string,
  overrides: Partial<FollowingEndpoint> = {},
): FollowingEndpoint => ({
  name,
  autoDeploy: false,
  latestRelease: `${name}-r2`,
  ...overrides,
});

describe('planEndpointFollow', () => {
  it.each`
    action       | given                                            | step
    ${'deploy'}  | ${{}}                                            | ${{ kind: 'bind', releaseName: 'api-r2' }}
    ${'deploy'}  | ${{ autoDeploy: true }}                          | ${{ kind: 'skip', reason: 'autoDeploy' }}
    ${'deploy'}  | ${{ latestRelease: undefined }}                  | ${{ kind: 'unreleased' }}
    ${'promote'} | ${{ sourceRelease: 'api-r1' }}                   | ${{ kind: 'bind', releaseName: 'api-r1' }}
    ${'promote'} | ${{}}                                            | ${{ kind: 'unboundInSource' }}
    ${'promote'} | ${{ autoDeploy: true, sourceRelease: 'api-r1' }} | ${{ kind: 'bind', releaseName: 'api-r1' }}
    ${'promote'} | ${{ autoDeploy: true }}                          | ${{ kind: 'unboundInSource' }}
    ${'promote'} | ${{ latestRelease: undefined }}                  | ${{ kind: 'unboundInSource' }}
  `('$action with $given: $step', ({ action, given, step }) => {
    expect(planEndpointFollow(action, [endpoint('api', given)])).toEqual([
      { endpoint: 'api', ...step },
    ]);
  });

  it('plans nothing for a component that owns no Endpoints', () => {
    expect(planEndpointFollow('promote', [])).toEqual([]);
  });
});

describe('checkPromotion', () => {
  const request = {
    componentName: 'orders',
    targetEnvironment: 'staging',
    sourceEnvironment: 'development',
  };

  it('lets a promotion go ahead when every Endpoint is bound in the source', () => {
    expect(
      checkPromotion(request, [
        { name: 'orders-api', sourceRelease: 'orders-api-r1' },
      ]),
    ).toBeUndefined();
  });

  it('lets a promotion go ahead when the line owns no Endpoints', () => {
    expect(checkPromotion(request, [])).toBeUndefined();
  });

  it('names every Endpoint not bound in the source', () => {
    expect(
      checkPromotion(request, [
        { name: 'orders-api' },
        { name: 'orders-web', sourceRelease: 'orders-web-r1' },
        { name: 'orders-admin' },
      ]),
    ).toEqual({ ...request, endpoints: ['orders-api', 'orders-admin'] });
  });
});

describe('promotionBlockedMessage', () => {
  const request = {
    componentName: 'orders',
    targetEnvironment: 'staging',
    sourceEnvironment: 'development',
  };

  it('names one Endpoint and how to fix it', () => {
    expect(
      promotionBlockedMessage({ ...request, endpoints: ['orders-api'] }),
    ).toBe(
      "Can't promote orders to staging: Endpoint orders-api isn't deployed in development. " +
        "Deploy it to development from the Endpoint's Deploy tab first, then promote.",
    );
  });

  it('names several Endpoints in one message', () => {
    const message = promotionBlockedMessage({
      ...request,
      endpoints: ['a', 'b', 'c'],
    });
    expect(message).toContain("Endpoints a, b and c aren't deployed");
    expect(message).toContain(
      "Deploy them to development from the Endpoint's Deploy tab first",
    );
    expect(message).not.toContain('occ');
  });
});
