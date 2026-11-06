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
});
