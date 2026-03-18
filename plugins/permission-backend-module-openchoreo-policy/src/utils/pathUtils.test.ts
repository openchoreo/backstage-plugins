import {
  parseCapabilityPath,
  isPathCoveredBy,
  hasUncoveredAllowedPath,
} from './pathUtils';

describe('parseCapabilityPath', () => {
  it('parses global wildcard', () => {
    expect(parseCapabilityPath('*')).toEqual({
      namespace: '*',
      project: '*',
      component: '*',
    });
  });

  it('parses namespace-only path', () => {
    expect(parseCapabilityPath('ns/acme')).toEqual({
      namespace: 'acme',
    });
  });

  it('parses namespace wildcard path', () => {
    expect(parseCapabilityPath('ns/*')).toEqual({
      namespace: '*',
    });
  });

  it('parses namespace and project path', () => {
    expect(parseCapabilityPath('ns/acme/project/foo')).toEqual({
      namespace: 'acme',
      project: 'foo',
    });
  });

  it('parses full path with component', () => {
    expect(parseCapabilityPath('ns/acme/project/foo/component/bar')).toEqual({
      namespace: 'acme',
      project: 'foo',
      component: 'bar',
    });
  });

  it('parses path with project wildcard', () => {
    expect(parseCapabilityPath('ns/acme/project/*')).toEqual({
      namespace: 'acme',
      project: '*',
    });
  });

  it('returns null for unrecognized path', () => {
    expect(parseCapabilityPath('unknown')).toBeNull();
    expect(parseCapabilityPath('')).toBeNull();
    expect(parseCapabilityPath('project/foo')).toBeNull();
    expect(parseCapabilityPath('component/bar')).toBeNull();
    expect(parseCapabilityPath('garbage/ns/acme')).toBeNull();
    expect(parseCapabilityPath('ns/acme/notproject/foo')).toBeNull();
  });

  it('invalid paths do not cover and are not covered', () => {
    expect(isPathCoveredBy('invalid', 'ns/acme')).toBe(false);
    expect(isPathCoveredBy('ns/acme', 'invalid')).toBe(false);
    expect(isPathCoveredBy('invalid', 'invalid')).toBe(false);
  });
});

describe('isPathCoveredBy', () => {
  it('global deny covers any allow', () => {
    expect(isPathCoveredBy('ns/acme/*', '*')).toBe(true);
    expect(isPathCoveredBy('ns/acme/project/foo/*', '*')).toBe(true);
    expect(isPathCoveredBy('*', '*')).toBe(true);
  });

  it('same-scope deny covers allow', () => {
    expect(isPathCoveredBy('ns/acme', 'ns/acme')).toBe(true);
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/acme/project/foo')).toBe(
      true,
    );
  });

  it('broader deny (namespace-level) covers narrower allow (project-level)', () => {
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/acme')).toBe(true);
    expect(
      isPathCoveredBy('ns/acme/project/foo/component/bar', 'ns/acme'),
    ).toBe(true);
    expect(
      isPathCoveredBy(
        'ns/acme/project/foo/component/bar',
        'ns/acme/project/foo',
      ),
    ).toBe(true);
  });

  it('narrower deny (project-level) does NOT cover broader allow (namespace-level)', () => {
    expect(isPathCoveredBy('ns/acme', 'ns/acme/project/secret')).toBe(false);
    expect(
      isPathCoveredBy('ns/acme', 'ns/acme/project/secret/component/api'),
    ).toBe(false);
  });

  it('different namespace deny does NOT cover', () => {
    expect(isPathCoveredBy('ns/acme', 'ns/other')).toBe(false);
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/other')).toBe(false);
  });

  it('deny narrower than global allow does NOT cover', () => {
    expect(isPathCoveredBy('*', 'ns/acme')).toBe(false);
    expect(isPathCoveredBy('*', 'ns/acme/project/foo')).toBe(false);
  });

  it('namespace wildcard deny covers all namespaces', () => {
    expect(isPathCoveredBy('ns/acme', 'ns/*')).toBe(true);
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/*')).toBe(true);
  });

  it('project wildcard deny covers all projects in that namespace', () => {
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/acme/project/*')).toBe(
      true,
    );
    expect(
      isPathCoveredBy('ns/acme/project/foo/component/bar', 'ns/acme/project/*'),
    ).toBe(true);
  });

  it('project wildcard deny in different namespace does NOT cover', () => {
    expect(isPathCoveredBy('ns/acme/project/foo', 'ns/other/project/*')).toBe(
      false,
    );
  });
});

describe('hasUncoveredAllowedPath', () => {
  it('returns false when no allowed paths', () => {
    expect(hasUncoveredAllowedPath([], ['*'])).toBe(false);
    expect(hasUncoveredAllowedPath([], [])).toBe(false);
  });

  it('returns true when no denied paths', () => {
    expect(hasUncoveredAllowedPath(['ns/acme'], [])).toBe(true);
  });

  it('returns false when all allowed paths are covered by denies', () => {
    expect(hasUncoveredAllowedPath(['ns/acme'], ['*'])).toBe(false);
    expect(hasUncoveredAllowedPath(['ns/acme'], ['ns/acme'])).toBe(false);
    expect(hasUncoveredAllowedPath(['ns/acme/project/foo'], ['ns/acme'])).toBe(
      false,
    );
  });

  it('returns true when at least one allowed path is uncovered', () => {
    expect(hasUncoveredAllowedPath(['ns/acme', 'ns/other'], ['ns/acme'])).toBe(
      true,
    );
  });

  it('returns true when deny is narrower than allow (project deny vs namespace allow)', () => {
    expect(
      hasUncoveredAllowedPath(['ns/acme'], ['ns/acme/project/secret']),
    ).toBe(true);
  });

  it('returns false when global deny covers everything', () => {
    expect(
      hasUncoveredAllowedPath(
        ['ns/acme', 'ns/other', 'ns/third/project/foo'],
        ['*'],
      ),
    ).toBe(false);
  });

  it('handles multiple allows with multiple denies', () => {
    // All covered
    expect(
      hasUncoveredAllowedPath(
        ['ns/acme/project/foo', 'ns/other/project/bar'],
        ['ns/acme', 'ns/other'],
      ),
    ).toBe(false);

    // One uncovered
    expect(
      hasUncoveredAllowedPath(
        ['ns/acme/project/foo', 'ns/other/project/bar'],
        ['ns/acme'],
      ),
    ).toBe(true);
  });
});
