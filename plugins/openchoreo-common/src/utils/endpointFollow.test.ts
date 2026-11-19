import { planEndpointFollow, type FollowingEndpoint } from './endpointFollow';

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
    action        | given                                            | step
    ${'deploy'}   | ${{}}                                            | ${{ kind: 'bind', releaseName: 'api-r2' }}
    ${'deploy'}   | ${{ autoDeploy: true }}                          | ${{ kind: 'skip', reason: 'autoDeploy' }}
    ${'deploy'}   | ${{ latestRelease: undefined }}                  | ${{ kind: 'unreleased' }}
    ${'promote'}  | ${{ sourceRelease: 'api-r1' }}                   | ${{ kind: 'bind', releaseName: 'api-r1' }}
    ${'promote'}  | ${{}}                                            | ${{ kind: 'bind', releaseName: 'api-r2' }}
    ${'promote'}  | ${{ autoDeploy: true, sourceRelease: 'api-r1' }} | ${{ kind: 'bind', releaseName: 'api-r1' }}
    ${'promote'}  | ${{ latestRelease: undefined }}                  | ${{ kind: 'unreleased' }}
    ${'redeploy'} | ${{ autoDeploy: true, sourceRelease: 'api-r1' }} | ${{ kind: 'bind', releaseName: 'api-r2' }}
    ${'redeploy'} | ${{ latestRelease: undefined }}                  | ${{ kind: 'unreleased' }}
  `('$action with $given: $step', ({ action, given, step }) => {
    expect(planEndpointFollow(action, [endpoint('api', given)])).toEqual([
      { endpoint: 'api', ...step },
    ]);
  });

  it('plans nothing for a component that owns no Endpoints', () => {
    expect(planEndpointFollow('promote', [])).toEqual([]);
  });
});
