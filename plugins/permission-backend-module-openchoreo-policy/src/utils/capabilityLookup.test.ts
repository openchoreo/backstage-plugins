import { resolveCapability, isConstrained } from './capabilityLookup';

describe('resolveCapability', () => {
  it('returns the exact-match entry when only one key is present', () => {
    const caps = {
      'releasebinding:create': { allowed: [{ path: 'ns/acme' }] },
    };
    expect(resolveCapability(caps, 'releasebinding:create')).toEqual({
      allowed: [{ path: 'ns/acme' }],
    });
  });

  it('falls back to the resource-class wildcard', () => {
    const caps = {
      'releasebinding:*': { allowed: [{ path: 'ns/acme' }] },
    };
    expect(resolveCapability(caps, 'releasebinding:create')).toEqual({
      allowed: [{ path: 'ns/acme' }],
    });
  });

  it('falls back to the global wildcard', () => {
    const caps = { '*': { allowed: [{ path: '*' }] } };
    expect(resolveCapability(caps, 'releasebinding:create')).toEqual({
      allowed: [{ path: '*' }],
    });
  });

  it('merges allowed/denied from multiple matching keys', () => {
    const caps = {
      'releasebinding:create': { allowed: [{ path: 'ns/acme' }] },
      'releasebinding:*': {
        allowed: [
          {
            path: 'ns/other',
            constraints: { expressions: ['resource.environment == "dev"'] },
          },
        ],
        denied: [{ path: 'ns/blocked' }],
      },
      '*': { allowed: [{ path: 'ns/global' }] },
    };
    const result = resolveCapability(caps, 'releasebinding:create');
    expect(result?.allowed).toEqual([
      { path: 'ns/acme' },
      {
        path: 'ns/other',
        constraints: { expressions: ['resource.environment == "dev"'] },
      },
      { path: 'ns/global' },
    ]);
    expect(result?.denied).toEqual([{ path: 'ns/blocked' }]);
  });

  it('deduplicates identical entries across wildcard keys', () => {
    const caps = {
      'releasebinding:create': { allowed: [{ path: 'ns/acme' }] },
      'releasebinding:*': { allowed: [{ path: 'ns/acme' }] },
    };
    expect(resolveCapability(caps, 'releasebinding:create')).toEqual({
      allowed: [{ path: 'ns/acme' }],
      denied: [],
    });
  });

  it('treats entries with different constraints as distinct', () => {
    const caps = {
      'releasebinding:create': { allowed: [{ path: 'ns/acme' }] },
      'releasebinding:*': {
        allowed: [
          {
            path: 'ns/acme',
            constraints: { expressions: ['resource.environment == "dev"'] },
          },
        ],
      },
    };
    expect(
      resolveCapability(caps, 'releasebinding:create')?.allowed,
    ).toHaveLength(2);
  });

  it('returns undefined when no key matches', () => {
    expect(resolveCapability({}, 'releasebinding:create')).toBeUndefined();
  });

  it('returns undefined when capabilities is undefined', () => {
    expect(
      resolveCapability(undefined, 'releasebinding:create'),
    ).toBeUndefined();
  });

  it('handles actions without a colon by merging exact + global wildcard', () => {
    const caps = {
      foo: { allowed: [{ path: 'ns/acme' }] },
      '*': { allowed: [{ path: '*' }] },
    };
    const result = resolveCapability(caps, 'foo');
    expect(result?.allowed).toEqual([{ path: 'ns/acme' }, { path: '*' }]);
  });
});

describe('isConstrained', () => {
  it('returns false for entries without constraints', () => {
    expect(isConstrained({ path: 'ns/acme' })).toBe(false);
  });

  it('returns false for entries with empty expression list', () => {
    expect(
      isConstrained({ path: 'ns/acme', constraints: { expressions: [] } }),
    ).toBe(false);
  });

  it('returns true for entries with at least one expression', () => {
    expect(
      isConstrained({
        path: 'ns/acme',
        constraints: { expressions: ['resource.environment == "dev"'] },
      }),
    ).toBe(true);
  });
});
