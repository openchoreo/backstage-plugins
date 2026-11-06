import type { JSONSchema7 } from 'json-schema';
import { pruneUnsetEmptyValues } from './utils';

describe('pruneUnsetEmptyValues', () => {
  const initial = {
    repository: {
      url: 'https://github.com/openchoreo/sample-workloads',
      revision: { branch: 'main' },
      appPath: '/service-go-greeter',
    },
    docker: {
      context: '/service-go-greeter',
      filePath: '/service-go-greeter/Dockerfile',
    },
  };

  it('drops empty schema defaults the user never set (#5344)', () => {
    const current = {
      ...initial,
      repository: {
        ...initial.repository,
        secretRef: '',
        revision: { branch: 'dev', commit: '' },
      },
    };

    expect(pruneUnsetEmptyValues(current, initial)).toEqual({
      ...initial,
      repository: { ...initial.repository, revision: { branch: 'dev' } },
    });
  });

  it('keeps a field that existed and was cleared', () => {
    const withSecret = {
      repository: { ...initial.repository, secretRef: 'creds' },
    };
    const current = {
      repository: { ...initial.repository, secretRef: '' },
    };

    expect(pruneUnsetEmptyValues(current, withSecret)).toEqual(current);
  });

  it('keeps a new non-empty value', () => {
    const current = {
      ...initial,
      repository: {
        ...initial.repository,
        revision: { branch: 'main', commit: 'abc123' },
      },
    };

    expect(pruneUnsetEmptyValues(current, initial)).toEqual(current);
  });

  it('drops a new object that is empty after pruning', () => {
    const current = { repository: initial.repository, docker: { context: '' } };

    expect(
      pruneUnsetEmptyValues(current, { repository: initial.repository }),
    ).toEqual({ repository: initial.repository });
  });

  it('drops new empty arrays and nulls but keeps non-empty arrays', () => {
    const buildArgs = [{ name: 'A', value: '1' }];
    const current = { ...initial, buildEnv: [], extra: null, buildArgs };

    expect(pruneUnsetEmptyValues(current, initial)).toEqual({
      ...initial,
      buildArgs,
    });
  });

  it('returns non-object input unchanged', () => {
    expect(pruneUnsetEmptyValues('value', {})).toBe('value');
    expect(pruneUnsetEmptyValues(null, {})).toBeNull();
  });

  describe('with the workflow schema', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        repository: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            secretRef: { type: 'string', default: '' },
            revision: {
              type: 'object',
              default: {},
              properties: {
                branch: { type: 'string', default: 'main' },
                commit: { type: 'string', default: '' },
              },
            },
            appPath: { type: 'string', default: '.' },
          },
        },
        buildArgs: {
          type: 'array',
          default: [{ name: 'DEFAULT', value: '1' }],
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              description: { type: 'string', default: '' },
            },
          },
        },
      },
    };

    it('drops injected empty defaults (#5344)', () => {
      const current = {
        ...initial,
        repository: {
          ...initial.repository,
          secretRef: '',
          revision: { branch: 'dev', commit: '' },
        },
      };

      expect(pruneUnsetEmptyValues(current, initial, schema)).toEqual({
        ...initial,
        repository: { ...initial.repository, revision: { branch: 'dev' } },
      });
    });

    it('keeps an explicit empty array that overrides a non-empty default', () => {
      const current = { ...initial, buildArgs: [] };

      expect(pruneUnsetEmptyValues(current, initial, schema)).toEqual(current);
    });

    it('keeps an explicit empty string that overrides a non-empty default', () => {
      const stored = { repository: { url: initial.repository.url } };
      const current = { repository: { ...stored.repository, appPath: '' } };

      expect(pruneUnsetEmptyValues(current, stored, schema)).toEqual(current);
    });

    it('drops injected empty defaults inside array items without removing items', () => {
      const stored = { buildArgs: [{ name: 'A', value: '1' }] };
      const current = {
        buildArgs: [
          { name: 'A', value: '1', description: '' },
          { name: 'B', value: '2', description: '' },
          { description: '' },
        ],
      };

      expect(pruneUnsetEmptyValues(current, stored, schema)).toEqual({
        buildArgs: [{ name: 'A', value: '1' }, { name: 'B', value: '2' }, {}],
      });
    });

    it('keeps array item values that were stored, even when empty', () => {
      const stored = {
        buildArgs: [{ name: 'A', value: '1', description: 'old' }],
      };
      const current = {
        buildArgs: [{ name: 'A', value: '1', description: '' }],
      };

      expect(pruneUnsetEmptyValues(current, stored, schema)).toEqual(current);
    });
  });
});
