import {
  getNestedValue,
  setNestedValue,
  walkSchemaForGitFields,
  extractGitFieldValues,
} from './schemaExtensions';

// ---- Tests ----

describe('getNestedValue', () => {
  it('returns top-level value', () => {
    expect(getNestedValue({ foo: 'bar' }, 'foo')).toBe('bar');
  });

  it('returns nested value', () => {
    expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing path', () => {
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined when intermediate is null', () => {
    expect(getNestedValue({ a: null }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when intermediate is a primitive', () => {
    expect(getNestedValue({ a: 'string' }, 'a.b')).toBeUndefined();
  });

  it('throws on __proto__ path segment', () => {
    expect(() => getNestedValue({}, '__proto__')).toThrow('Unsafe path segment');
  });

  it('throws on constructor path segment', () => {
    expect(() => getNestedValue({}, 'a.constructor')).toThrow('Unsafe path segment');
  });

  it('throws on prototype path segment', () => {
    expect(() => getNestedValue({}, 'prototype.x')).toThrow('Unsafe path segment');
  });
});

describe('setNestedValue', () => {
  it('sets top-level value', () => {
    const obj: Record<string, any> = {};
    setNestedValue(obj, 'foo', 'bar');
    expect(obj.foo).toBe('bar');
  });

  it('sets deeply nested value, creating intermediates', () => {
    const obj: Record<string, any> = {};
    setNestedValue(obj, 'a.b.c', 42);
    expect(obj.a.b.c).toBe(42);
  });

  it('overwrites existing value', () => {
    const obj: Record<string, any> = { a: { b: 1 } };
    setNestedValue(obj, 'a.b', 2);
    expect(obj.a.b).toBe(2);
  });

  it('replaces primitive intermediate with object', () => {
    const obj: Record<string, any> = { a: 'string' };
    setNestedValue(obj, 'a.b', 1);
    expect(obj.a.b).toBe(1);
  });

  it('throws on unsafe path segment', () => {
    expect(() => setNestedValue({}, '__proto__.polluted', true)).toThrow(
      'Unsafe path segment',
    );
  });
});

describe('walkSchemaForGitFields', () => {
  it('returns empty mapping for schema without extensions', () => {
    const properties = {
      name: { type: 'string' },
      count: { type: 'integer' },
    };
    expect(walkSchemaForGitFields(properties, '')).toEqual({});
  });

  it('detects repo URL extension at top level', () => {
    const properties = {
      repoUrl: {
        type: 'string',
        'x-openchoreo-component-parameter-repository-url': true,
      },
    };
    expect(walkSchemaForGitFields(properties, '')).toEqual({
      repoUrl: 'repoUrl',
    });
  });

  it('detects nested extensions with prefix', () => {
    const properties = {
      repository: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            'x-openchoreo-component-parameter-repository-url': true,
          },
          revision: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                'x-openchoreo-component-parameter-repository-branch': true,
              },
              commit: {
                type: 'string',
                'x-openchoreo-component-parameter-repository-commit': true,
              },
            },
          },
        },
      },
    };

    const mapping = walkSchemaForGitFields(properties, '');
    expect(mapping).toEqual({
      repoUrl: 'repository.url',
      branch: 'repository.revision.branch',
      commit: 'repository.revision.commit',
    });
  });

  it('skips null/non-object property schemas', () => {
    const properties = {
      bad: null,
      good: {
        type: 'string',
        'x-openchoreo-component-parameter-repository-url': true,
      },
    };
    expect(walkSchemaForGitFields(properties as any, '')).toEqual({
      repoUrl: 'good',
    });
  });

  it('applies prefix correctly', () => {
    const properties = {
      url: {
        type: 'string',
        'x-openchoreo-component-parameter-repository-url': true,
      },
    };
    expect(walkSchemaForGitFields(properties, 'spec')).toEqual({
      repoUrl: 'spec.url',
    });
  });
});

describe('extractGitFieldValues', () => {
  it('returns empty object when parameters is null', () => {
    expect(extractGitFieldValues(null, { repoUrl: 'url' })).toEqual({});
  });

  it('returns empty object when parameters is undefined', () => {
    expect(extractGitFieldValues(undefined, { repoUrl: 'url' })).toEqual({});
  });

  it('returns empty object when mapping is empty', () => {
    expect(extractGitFieldValues({ url: 'http://example.com' }, {})).toEqual(
      {},
    );
  });

  it('extracts values from flat parameters', () => {
    const params = { url: 'http://example.com', branch: 'main' };
    const mapping = { repoUrl: 'url', branch: 'branch' };
    expect(extractGitFieldValues(params, mapping)).toEqual({
      repoUrl: 'http://example.com',
      branch: 'main',
    });
  });

  it('extracts values from nested parameters', () => {
    const params = { repo: { url: 'http://example.com', rev: { commit: 'abc123' } } };
    const mapping = { repoUrl: 'repo.url', commit: 'repo.rev.commit' };
    expect(extractGitFieldValues(params, mapping)).toEqual({
      repoUrl: 'http://example.com',
      commit: 'abc123',
    });
  });

  it('skips undefined/null/empty values', () => {
    const params = { url: '', branch: null, commit: undefined, path: '/app' };
    const mapping = {
      repoUrl: 'url',
      branch: 'branch',
      commit: 'commit',
      appPath: 'path',
    };
    expect(extractGitFieldValues(params, mapping)).toEqual({
      appPath: '/app',
    });
  });

  it('converts non-string values to strings', () => {
    const params = { count: 42 };
    const mapping = { repoUrl: 'count' };
    expect(extractGitFieldValues(params, mapping)).toEqual({
      repoUrl: '42',
    });
  });
});
