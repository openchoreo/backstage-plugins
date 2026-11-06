import { ConfigReader } from '@backstage/config';
import type { Entity } from '@backstage/catalog-model';
import { ScmIntegrations } from '@backstage/integration';
import {
  parseRepositoryReference,
  resolveBranch,
  resolveGithubRepository,
} from './repository';
import { DEFAULT_REPO_ANNOTATIONS } from './options';

function entityWith(annotations: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'svc', annotations },
  };
}

const integrations = ScmIntegrations.fromConfig(
  new ConfigReader({
    integrations: {
      github: [
        {
          host: 'ghe.example.com',
          apiBaseUrl: 'https://ghe.example.com/api/v3',
        },
        { host: 'ghe-no-api.example.com' },
      ],
      gitlab: [{ host: 'gitlab.com' }],
    },
  }),
);

describe('parseRepositoryReference', () => {
  it.each([
    [
      'url:https://github.com/org/repo',
      { host: 'github.com', owner: 'org', name: 'repo' },
    ],
    [
      'https://github.com/org/repo.git',
      { host: 'github.com', owner: 'org', name: 'repo' },
    ],
    [
      'https://github.com/org/repo/',
      { host: 'github.com', owner: 'org', name: 'repo' },
    ],
    [
      'url:https://github.com/org/repo/tree/main/services/api',
      { host: 'github.com', owner: 'org', name: 'repo', ref: 'main' },
    ],
    [
      'url:https://github.com/org/repo/tree/main/services/api/',
      { host: 'github.com', owner: 'org', name: 'repo', ref: 'main' },
    ],
    [
      'https://github.com/org/repo/blob/dev/README.md',
      { host: 'github.com', owner: 'org', name: 'repo', ref: 'dev' },
    ],
    [
      'git@github.com:org/repo.git',
      { host: 'github.com', owner: 'org', name: 'repo' },
    ],
    [
      'ssh://git@github.com/org/repo.git',
      { host: 'github.com', owner: 'org', name: 'repo' },
    ],
    ['org/repo', { owner: 'org', name: 'repo' }],
  ])('parses %s', (value, expected) => {
    expect(parseRepositoryReference(value)).toEqual({
      ref: undefined,
      ...expected,
    });
  });

  it.each(['', 'not a url', 'https://github.com/org', 'url:./relative/path'])(
    'rejects %p',
    value => {
      expect(parseRepositoryReference(value)).toBeUndefined();
    },
  );
});

describe('resolveGithubRepository', () => {
  it('prefers source-location over project-slug', () => {
    const repository = resolveGithubRepository(
      entityWith({
        'backstage.io/source-location': 'url:https://github.com/from/location',
        'github.com/project-slug': 'from/slug',
      }),
      integrations,
      DEFAULT_REPO_ANNOTATIONS,
    );
    expect(repository).toMatchObject({ owner: 'from', name: 'location' });
  });

  it('falls back to project-slug on github.com when source-location is not GitHub', () => {
    const repository = resolveGithubRepository(
      entityWith({
        'backstage.io/source-location': 'url:https://gitlab.com/group/project',
        'github.com/project-slug': 'org/repo',
      }),
      integrations,
      DEFAULT_REPO_ANNOTATIONS,
    );
    expect(repository).toEqual({
      host: 'github.com',
      owner: 'org',
      name: 'repo',
      url: 'https://github.com/org/repo',
      apiBaseUrl: 'https://api.github.com',
      urlRef: undefined,
    });
  });

  it('resolves a GitHub Enterprise host through its integration', () => {
    const repository = resolveGithubRepository(
      entityWith({
        'backstage.io/source-location':
          'url:https://ghe.example.com/team/svc/tree/release/',
      }),
      integrations,
      DEFAULT_REPO_ANNOTATIONS,
    );
    expect(repository).toMatchObject({
      host: 'ghe.example.com',
      apiBaseUrl: 'https://ghe.example.com/api/v3',
      urlRef: 'release',
    });
  });

  it('throws for a GitHub host without an API base URL', () => {
    expect(() =>
      resolveGithubRepository(
        entityWith({
          'backstage.io/source-location':
            'url:https://ghe-no-api.example.com/a/b',
        }),
        integrations,
        DEFAULT_REPO_ANNOTATIONS,
      ),
    ).toThrow(/no integrations.github apiBaseUrl/);
  });

  it('returns undefined when no annotation names a GitHub repository', () => {
    expect(
      resolveGithubRepository(
        entityWith({
          'backstage.io/source-location':
            'url:https://gitlab.com/group/project',
        }),
        integrations,
        DEFAULT_REPO_ANNOTATIONS,
      ),
    ).toBeUndefined();
  });
});

describe('resolveBranch', () => {
  const repository = resolveGithubRepository(
    entityWith({
      'backstage.io/source-location':
        'url:https://github.com/org/repo/tree/main/',
    }),
    integrations,
    DEFAULT_REPO_ANNOTATIONS,
  )!;

  it('prefers a configured branch annotation over the URL ref', () => {
    expect(
      resolveBranch(
        entityWith({ 'openchoreo.io/branch': 'develop' }),
        repository,
        ['openchoreo.io/branch'],
      ),
    ).toBe('develop');
  });

  it('falls back to the URL ref', () => {
    expect(
      resolveBranch(entityWith({}), repository, ['openchoreo.io/branch']),
    ).toBe('main');
  });

  it('returns undefined when neither is present, leaving the default branch', () => {
    expect(
      resolveBranch(entityWith({}), { ...repository, urlRef: undefined }, []),
    ).toBeUndefined();
  });
});
