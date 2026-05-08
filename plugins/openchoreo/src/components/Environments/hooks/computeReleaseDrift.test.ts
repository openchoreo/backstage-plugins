import { computeReleaseDrift } from './computeReleaseDrift';
import type { Environment } from './useEnvironmentData';

function makeEnv(
  overrides: Partial<Environment> & { name: string },
): Environment {
  return {
    name: overrides.name,
    deployment: overrides.deployment ?? { status: 'Ready' },
    endpoints: overrides.endpoints ?? [],
    promotionTargets: overrides.promotionTargets,
  };
}

describe('computeReleaseDrift', () => {
  it('returns no drift when env has no releaseName', () => {
    const dev = makeEnv({
      name: 'dev',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'staging' }],
    });
    const staging = makeEnv({ name: 'staging' });
    expect(computeReleaseDrift(staging, [dev, staging])).toEqual({
      isBehind: false,
      aheadUpstreams: [],
    });
  });

  it('returns no drift for root env (no upstream)', () => {
    const dev = makeEnv({
      name: 'dev',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'staging' }],
    });
    const staging = makeEnv({
      name: 'staging',
      deployment: { releaseName: 'rel-7' },
    });
    expect(computeReleaseDrift(dev, [dev, staging])).toEqual({
      isBehind: false,
      aheadUpstreams: [],
    });
  });

  it('returns no drift when upstream releaseName matches', () => {
    const dev = makeEnv({
      name: 'dev',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'staging' }],
    });
    const staging = makeEnv({
      name: 'staging',
      deployment: { releaseName: 'rel-7' },
    });
    expect(computeReleaseDrift(staging, [dev, staging])).toEqual({
      isBehind: false,
      aheadUpstreams: [],
    });
  });

  it('marks env as behind when upstream is on a different release', () => {
    const dev = makeEnv({
      name: 'dev',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'staging' }],
    });
    const staging = makeEnv({
      name: 'staging',
      deployment: { releaseName: 'rel-5' },
    });
    expect(computeReleaseDrift(staging, [dev, staging])).toEqual({
      isBehind: true,
      aheadUpstreams: [{ envName: 'dev', releaseName: 'rel-7' }],
    });
  });

  it('lists only mismatched upstreams when there are several', () => {
    const a = makeEnv({
      name: 'a',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'prod' }],
    });
    const b = makeEnv({
      name: 'b',
      deployment: { releaseName: 'rel-5' },
      promotionTargets: [{ name: 'prod' }],
    });
    const c = makeEnv({
      name: 'c',
      deployment: { releaseName: 'rel-7' },
      promotionTargets: [{ name: 'prod' }],
    });
    const prod = makeEnv({
      name: 'prod',
      deployment: { releaseName: 'rel-5' },
    });
    const result = computeReleaseDrift(prod, [a, b, c, prod]);
    expect(result.isBehind).toBe(true);
    // a and c have rel-7 (mismatched); b has rel-5 (matches prod).
    expect(result.aheadUpstreams.map(u => u.envName).sort()).toEqual([
      'a',
      'c',
    ]);
  });

  it('ignores upstreams without a releaseName', () => {
    const dev = makeEnv({
      name: 'dev',
      deployment: {},
      promotionTargets: [{ name: 'staging' }],
    });
    const staging = makeEnv({
      name: 'staging',
      deployment: { releaseName: 'rel-7' },
    });
    expect(computeReleaseDrift(staging, [dev, staging])).toEqual({
      isBehind: false,
      aheadUpstreams: [],
    });
  });
});
