import {
  diffOverrides,
  diffTraits,
  isInheritedTrait,
  mergeOverrides,
  mergeTraits,
} from './releaseLineOverrides';

describe('mergeOverrides', () => {
  it('deep-merges the override onto the base', () => {
    expect(
      mergeOverrides(
        {
          logLevel: 'info',
          repository: { url: 'u', revision: { branch: 'main' } },
        },
        { logLevel: 'warn', repository: { revision: { branch: 'next' } } },
      ),
    ).toEqual({
      logLevel: 'warn',
      repository: { url: 'u', revision: { branch: 'next' } },
    });
  });
});

describe('diffOverrides', () => {
  it('keeps only what differs from the base', () => {
    expect(
      diffOverrides(
        {
          logLevel: 'warn',
          repository: { url: 'u', revision: { branch: 'next' } },
        },
        {
          logLevel: 'info',
          repository: { url: 'u', revision: { branch: 'main' } },
        },
      ),
    ).toEqual({
      logLevel: 'warn',
      repository: { revision: { branch: 'next' } },
    });
  });

  it('is empty when nothing changed', () => {
    expect(diffOverrides({ a: { b: [1] } }, { a: { b: [1] } })).toEqual({});
  });

  it('round-trips with mergeOverrides', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const value = { a: 1, b: { c: 5, d: 3 }, e: 'x' };
    expect(mergeOverrides(base, diffOverrides(value, base))).toEqual(value);
  });
});

describe('traits', () => {
  const health = {
    kind: 'ClusterTrait',
    name: 'health-probes',
    instanceName: 'health',
    parameters: { path: '/' },
  };
  const hpa = {
    kind: 'ClusterTrait',
    name: 'hpa',
    instanceName: 'scale',
    parameters: { max: 2 },
  };

  it('merges release line traits by kind, name and instance name', () => {
    expect(
      mergeTraits(
        [health],
        [{ ...health, parameters: { path: '/greet' } }, hpa],
      ),
    ).toEqual([{ ...health, parameters: { path: '/greet' } }, hpa]);
  });

  it('declares only new and changed traits', () => {
    const changed = { ...health, parameters: { path: '/greet' } };
    expect(diffTraits([health, hpa], [health])).toEqual([hpa]);
    expect(diffTraits([changed], [health])).toEqual([changed]);
  });

  it('tells inherited traits apart', () => {
    expect(isInheritedTrait(health, [health])).toBe(true);
    expect(isInheritedTrait(hpa, [health])).toBe(false);
  });
});
