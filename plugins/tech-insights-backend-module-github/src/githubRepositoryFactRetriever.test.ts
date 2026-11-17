import { ConfigReader } from '@backstage/config';
import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { GithubApiResponse } from './githubApi';
import { createGithubRepositoryFactRetriever } from './githubRepositoryFactRetriever';

const mockGetEntities = jest.fn();
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: mockGetEntities,
  })),
}));

const mockGetRepo = jest.fn();
jest.mock('./githubApi', () => ({
  ...jest.requireActual('./githubApi'),
  createGithubApi: () => ({ getRepo: mockGetRepo }),
}));

const component: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'svc',
    namespace: 'default',
    annotations: { 'github.com/project-slug': 'org/repo' },
  },
};

function context(): FactRetrieverContext {
  return {
    config: new ConfigReader({}),
    discovery: mockServices.discovery(),
    auth: mockServices.auth(),
    logger: mockServices.logger.mock(),
    entityFilter: [{ kind: 'component' }],
  } as unknown as FactRetrieverContext;
}

function respondWith(protection: GithubApiResponse) {
  const responses: Record<string, GithubApiResponse> = {
    '': {
      status: 200,
      body: { default_branch: 'main', archived: false, visibility: 'public' },
    },
    '/branches/main': { status: 200, body: { protected: true } },
    '/rules/branches/main?per_page=100': {
      status: 200,
      body: [
        {
          type: 'pull_request',
          parameters: { required_approving_review_count: 1 },
        },
      ],
    },
    '/branches/main/protection': protection,
  };
  mockGetRepo.mockImplementation(async (_repository, path = '') =>
    path.startsWith('/contents')
      ? { status: 404, body: { message: 'Not Found' } }
      : responses[path],
  );
}

async function collectFacts() {
  const retriever = createGithubRepositoryFactRetriever({
    cache: mockServices.cache.mock(),
  });
  const [result] = await retriever.handler(context());
  return result.facts;
}

describe('githubRepositoryFactRetriever', () => {
  beforeEach(() => {
    mockGetEntities.mockReset().mockResolvedValue({ items: [component] });
    mockGetRepo.mockReset();
  });

  it('reports ruleset protection on a branch without classic protection', async () => {
    respondWith({ status: 404, body: { message: 'Branch not protected' } });

    expect(await collectFacts()).toMatchObject({
      githubBranchProtected: true,
      githubRequiresPullRequest: true,
      githubRequiredApprovingReviewCount: 1,
      githubAllowsForcePushes: true,
      githubAllowsDeletions: true,
    });
  });

  it('omits unsettled settings when classic protection is unreadable', async () => {
    respondWith({ status: 404, body: { message: 'Not Found' } });

    const facts = await collectFacts();
    expect(facts).toMatchObject({
      githubBranchProtected: true,
      githubRequiresPullRequest: true,
    });
    expect(facts).not.toHaveProperty('githubRequiredApprovingReviewCount');
    expect(facts).not.toHaveProperty('githubAllowsForcePushes');
  });

  it.each(['', '/branches/main'])(
    'reports a refused read of %p as unresolved',
    async refusedPath => {
      respondWith({ status: 404, body: { message: 'Branch not protected' } });
      const respond = mockGetRepo.getMockImplementation()!;
      mockGetRepo.mockImplementation(async (repository, path = '') =>
        path === refusedPath
          ? { status: 403, body: { message: 'Resource not accessible' } }
          : respond(repository, path),
      );

      expect(await collectFacts()).toMatchObject({
        githubRepositoryResolved: false,
        githubBranchProtected: null,
      });
    },
  );

  function override(
    match: (repositoryName: string, path: string) => boolean,
    response: GithubApiResponse,
  ) {
    const respond = mockGetRepo.getMockImplementation()!;
    mockGetRepo.mockImplementation(async (repository, path = '') =>
      match(repository.name, path) ? response : respond(repository, path),
    );
  }

  it('leaves out file facts when a folder listing is refused', async () => {
    respondWith({ status: 404, body: { message: 'Branch not protected' } });
    override((_name, path) => path.startsWith('/contents/.github'), {
      status: 403,
      body: { message: 'Resource not accessible' },
    });

    const facts = await collectFacts();
    expect(facts).toMatchObject({
      githubRepositoryResolved: true,
      githubBranchProtected: true,
    });
    expect(facts).not.toHaveProperty('githubHasCodeowners');
    expect(facts).not.toHaveProperty('githubHasSecurityPolicy');
  });

  it('treats a missing rulesets endpoint as no rulesets', async () => {
    respondWith({ status: 404, body: { message: 'Branch not protected' } });
    override((_name, path) => path.startsWith('/rules/'), {
      status: 404,
      body: { message: 'Not Found' },
    });

    expect(await collectFacts()).toMatchObject({
      githubRepositoryResolved: true,
      githubBranchProtected: false,
      githubRequiresPullRequest: false,
    });
  });

  it('reports what classic protection settles when rulesets are refused', async () => {
    respondWith({
      status: 200,
      body: {
        required_pull_request_reviews: { required_approving_review_count: 2 },
        allow_force_pushes: { enabled: false },
      },
    });
    override((_name, path) => path.startsWith('/rules/'), {
      status: 403,
      body: { message: 'Upgrade to GitHub Pro' },
    });

    const facts = await collectFacts();
    expect(facts).toMatchObject({
      githubBranchProtected: true,
      githubRequiresPullRequest: true,
      githubAllowsForcePushes: false,
    });
    expect(facts).not.toHaveProperty('githubRequiredApprovingReviewCount');
    expect(facts).not.toHaveProperty('githubRequiresStatusChecks');
  });

  describe("the owner's default SECURITY.md", () => {
    function withDefaults(defaults: GithubApiResponse) {
      respondWith({ status: 404, body: { message: 'Branch not protected' } });
      override((name, path) => name === '.github' && path === '', defaults);
      override((name, path) => name === '.github' && path === '/contents', {
        status: 200,
        body: [{ type: 'file', name: 'SECURITY.md' }],
      });
    }

    it('counts one in a public .github repository', async () => {
      withDefaults({ status: 200, body: { private: false } });
      expect(await collectFacts()).toMatchObject({
        githubHasSecurityPolicy: true,
        githubHasCodeowners: false,
      });
    });

    it('ignores one in a private .github repository', async () => {
      withDefaults({ status: 200, body: { private: true } });
      expect(await collectFacts()).toMatchObject({
        githubHasSecurityPolicy: false,
      });
    });

    it('leaves out only the security fact when the .github repository fails', async () => {
      withDefaults({ status: 502, body: undefined });
      const facts = await collectFacts();
      expect(facts).toMatchObject({
        githubRepositoryResolved: true,
        githubHasCodeowners: false,
      });
      expect(facts).not.toHaveProperty('githubHasSecurityPolicy');
    });

    it('reports none when the owner has no .github repository', async () => {
      withDefaults({ status: 404, body: { message: 'Not Found' } });
      expect(await collectFacts()).toMatchObject({
        githubHasSecurityPolicy: false,
      });
    });
  });

  describe('a branch containing a slash', () => {
    const sourceLocation = {
      'backstage.io/source-location':
        'url:https://github.com/org/repo/tree/feature/login/svc/',
    };

    function respondWithBranch(branch: string) {
      mockGetRepo.mockImplementation(async (_repository, path = '') => {
        if (path === '') {
          return { status: 200, body: { default_branch: 'main' } };
        }
        if (path === `/branches/${branch}`) {
          return { status: 200, body: { protected: false } };
        }
        if (path === `/rules/branches/${branch}?per_page=100`) {
          return { status: 200, body: [] };
        }
        return { status: 404, body: { message: 'Not Found' } };
      });
    }

    function branchLookups() {
      return mockGetRepo.mock.calls
        .map(([, path]) => path as string)
        .filter(path => /^\/branches\/[^?]*$/.test(path));
    }

    it('finds the branch in the URL ref path when no annotation names it', async () => {
      mockGetEntities.mockResolvedValue({
        items: [
          {
            ...component,
            metadata: { ...component.metadata, annotations: sourceLocation },
          },
        ],
      });
      respondWithBranch('feature/login');

      expect(await collectFacts()).toMatchObject({
        githubRepositoryResolved: true,
        githubBranch: 'feature/login',
      });
      expect(branchLookups()).toEqual([
        '/branches/feature',
        '/branches/feature/login',
      ]);
    });

    it('reads the branch from openchoreo.io/branch without config', async () => {
      mockGetEntities.mockResolvedValue({
        items: [
          {
            ...component,
            metadata: {
              ...component.metadata,
              annotations: {
                ...sourceLocation,
                'openchoreo.io/branch': 'feature/login',
              },
            },
          },
        ],
      });
      respondWithBranch('feature/login');

      expect(await collectFacts()).toMatchObject({
        githubBranch: 'feature/login',
      });
      expect(branchLookups()).toEqual(['/branches/feature/login']);
    });

    it('reports unresolved when no part of the URL ref path is a branch', async () => {
      mockGetEntities.mockResolvedValue({
        items: [
          {
            ...component,
            metadata: { ...component.metadata, annotations: sourceLocation },
          },
        ],
      });
      respondWithBranch('other');

      expect(await collectFacts()).toMatchObject({
        githubRepositoryResolved: false,
        githubBranch: null,
      });
      expect(branchLookups()).toHaveLength(3);
    });
  });
});
