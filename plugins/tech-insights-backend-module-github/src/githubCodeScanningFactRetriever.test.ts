import { ConfigReader } from '@backstage/config';
import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type {
  FactRetrieverContext,
  TechInsightFact,
} from '@backstage-community/plugin-tech-insights-node';
import { GithubRateLimitError } from './githubApi';
import { createGithubCodeScanningFactRetriever } from './githubCodeScanningFactRetriever';
import { codeScanningFacts } from './codeScanningFacts';
import { DEFAULT_CODE_SCANNING_TOOLS } from './options';

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

function component(
  name: string,
  slug?: string,
  annotations: Record<string, string> = {},
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'default',
      annotations: {
        ...(slug ? { 'github.com/project-slug': slug } : {}),
        ...annotations,
      },
    },
  };
}

const context = () =>
  ({
    config: new ConfigReader({}),
    discovery: mockServices.discovery(),
    auth: mockServices.auth(),
    logger: mockServices.logger.mock(),
    entityFilter: [{ kind: 'component' }],
  } as unknown as FactRetrieverContext);

const alerts = (severity: string | null, count: number) =>
  Array.from({ length: count }, () => ({
    rule: { security_severity_level: severity },
  }));

/**
 * Answers like GitHub did when probed live: the alerts listing gives 200 with
 * an empty list for a tool with no uploads unless the repository has no uploads
 * at all, while the analyses endpoint gives a 404. `branches` exist, and
 * `main` is the default.
 */
function githubWithUploads(
  uploads: Record<string, ReturnType<typeof alerts>>,
  {
    analysesOfUnusedTool = { status: 404 },
    branches = ['main'],
  }: {
    analysesOfUnusedTool?: { status: number; body?: unknown };
    branches?: string[];
  } = {},
) {
  mockGetRepo.mockImplementation(async (_repository, path = '') => {
    if (path === '') {
      return { status: 200, body: { default_branch: 'main' } };
    }
    if (path.startsWith('/branches/')) {
      const name = path
        .slice('/branches/'.length)
        .split('/')
        .map(decodeURIComponent)
        .join('/');
      return branches.includes(name)
        ? { status: 200, body: { name } }
        : { status: 404 };
    }
    const query = new URLSearchParams(path.split('?')[1]);
    const toolName = query.get('tool_name')!;
    if (path.startsWith('/code-scanning/analyses')) {
      return toolName in uploads
        ? { status: 200, body: [{ tool: { name: toolName } }] }
        : analysesOfUnusedTool;
    }
    if (Object.keys(uploads).length === 0) {
      return { status: 404 };
    }
    const page = Number(query.get('page'));
    const perPage = Number(query.get('per_page'));
    return {
      status: 200,
      body: (uploads[toolName] ?? []).slice(
        (page - 1) * perPage,
        page * perPage,
      ),
    };
  });
}

const scanRequests = () =>
  mockGetRepo.mock.calls
    .map(([, path]) => String(path))
    .filter(path => path.startsWith('/code-scanning/'));

const alertRequests = () =>
  scanRequests().filter(path => path.startsWith('/code-scanning/alerts'));

const unresolved = {
  githubCodeScanners: null,
  ...codeScanningFacts('codeql', undefined),
  ...codeScanningFacts('trivy', undefined),
};

describe('createGithubCodeScanningFactRetriever', () => {
  const retriever = (options = {}) =>
    createGithubCodeScanningFactRetriever({
      cache: mockServices.cache.mock(),
      options: {
        schemaVersion: 1,
        tools: DEFAULT_CODE_SCANNING_TOOLS,
        ...options,
      },
    });
  const run = async (options = {}, ctx = context()) => {
    const results = await retriever(options).handler(ctx);
    return results as TechInsightFact[];
  };

  beforeEach(() => {
    mockGetRepo.mockReset();
    mockGetEntities.mockReset();
    mockGetEntities.mockResolvedValue({
      items: [component('a', 'org/a')],
    });
  });

  describe('a scanner that never ran and one that found nothing', () => {
    it('reports real zeros for a scanner that ran and found nothing', async () => {
      githubWithUploads({ CodeQL: [], Trivy: [] });
      const [{ facts }] = await run();
      expect(facts).toEqual({
        githubCodeScanners: ['codeql', 'trivy'],
        ...codeScanningFacts('codeql', []),
        ...codeScanningFacts('trivy', []),
      });
      expect(facts.githubTrivyScanEnabled).toBe(true);
      expect(facts.githubTrivyOpenCriticalAlertCount).toBe(0);
      expect(facts.githubTrivyHasOpenCriticalAlerts).toBe(false);
    });

    it('reports a scanner as not enabled when only another scanner uploaded', async () => {
      githubWithUploads({ CodeQL: alerts('critical', 1) });
      const [{ facts }] = await run();
      expect(facts).toMatchObject({
        githubCodeScanners: ['codeql'],
        githubCodeqlScanEnabled: true,
        githubCodeqlOpenCriticalAlertCount: 1,
        githubTrivyScanEnabled: false,
        githubTrivyOpenCriticalAlertCount: null,
        githubTrivyOpenAlertCount: null,
        githubTrivyHasOpenCriticalAlerts: null,
      });
    });

    it('never reads alerts for a scanner that never ran', async () => {
      githubWithUploads({ CodeQL: [] });
      await run();
      expect(alertRequests().join()).not.toContain('tool_name=Trivy');
    });

    it('treats an empty list of analyses as never ran', async () => {
      githubWithUploads(
        { CodeQL: [] },
        { analysesOfUnusedTool: { status: 200, body: [] } },
      );
      const [{ facts }] = await run();
      expect(facts.githubTrivyScanEnabled).toBe(false);
      expect(facts.githubTrivyOpenCriticalAlertCount).toBeNull();
    });

    it('reports every scanner as not enabled for a repository with no uploads', async () => {
      githubWithUploads({});
      const [{ facts }] = await run();
      expect(facts).toEqual({
        githubCodeScanners: [],
        ...codeScanningFacts('codeql', undefined),
        ...codeScanningFacts('trivy', undefined),
      });
    });
  });

  describe('the branch it reads', () => {
    const ref = (branch: string) =>
      `ref=${encodeURIComponent(`refs/heads/${branch}`)}&`;

    it('reads the default branch when the component names none', async () => {
      githubWithUploads({ CodeQL: [], Trivy: [] });
      await run();
      expect(mockGetRepo).toHaveBeenCalledWith(
        expect.anything(),
        '/branches/main',
      );
      expect(scanRequests()).toHaveLength(4);
      scanRequests().forEach(path => expect(path).toContain(ref('main')));
    });

    it('reads the branch named by openchoreo.io/branch', async () => {
      mockGetEntities.mockResolvedValue({
        items: [
          component('a', 'org/a', { 'openchoreo.io/branch': 'release/1.x' }),
        ],
      });
      githubWithUploads(
        { CodeQL: [], Trivy: alerts('high', 1) },
        { branches: ['main', 'release/1.x'] },
      );
      const [{ facts }] = await run();
      expect(facts.githubTrivyOpenHighAlertCount).toBe(1);
      expect(scanRequests()).toHaveLength(4);
      scanRequests().forEach(path =>
        expect(path).toContain(ref('release/1.x')),
      );
    });

    it('reads the first branch in the source URL that exists', async () => {
      mockGetEntities.mockResolvedValue({
        items: [
          component('a', undefined, {
            'backstage.io/source-location':
              'url:https://github.com/org/a/tree/feature/login/docs/',
          }),
        ],
      });
      githubWithUploads(
        { CodeQL: [], Trivy: [] },
        { branches: ['main', 'feature/login'] },
      );
      await run();
      scanRequests().forEach(path =>
        expect(path).toContain(ref('feature/login')),
      );
    });

    it.each([
      ['does not exist', 404],
      ['is refused', 403],
    ])(
      'reports the facts unresolved when the named branch %s',
      async (_name, status) => {
        mockGetEntities.mockResolvedValue({
          items: [component('a', 'org/a', { 'openchoreo.io/branch': 'gone' })],
        });
        githubWithUploads({ CodeQL: [], Trivy: [] });
        const answer = mockGetRepo.getMockImplementation()!;
        mockGetRepo.mockImplementation(async (repository, path = '') =>
          path === '/branches/gone' ? { status } : answer(repository, path),
        );
        const [{ facts }] = await run();
        expect(facts).toEqual(unresolved);
        expect(scanRequests()).toEqual([]);
      },
    );

    it('skips the entity when looking up the branch fails', async () => {
      githubWithUploads({ CodeQL: [], Trivy: [] });
      const answer = mockGetRepo.getMockImplementation()!;
      mockGetRepo.mockImplementation(async (repository, path = '') =>
        path.startsWith('/branches/')
          ? { status: 500 }
          : answer(repository, path),
      );
      const ctx = context();
      await expect(run({}, ctx)).resolves.toEqual([]);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("GET branch 'main' of org/a returned HTTP 500"),
      );
    });
  });

  describe('counts', () => {
    it('reports the counts of each scanner separately', async () => {
      githubWithUploads({
        CodeQL: alerts('critical', 1),
        Trivy: [
          ...alerts('critical', 1),
          ...alerts('high', 22),
          ...alerts('medium', 32),
          ...alerts('low', 3),
        ],
      });
      const [{ facts }] = await run();
      expect(facts).toEqual({
        githubCodeScanners: ['codeql', 'trivy'],
        githubCodeqlScanEnabled: true,
        githubCodeqlOpenCriticalAlertCount: 1,
        githubCodeqlOpenHighAlertCount: 0,
        githubCodeqlOpenMediumAlertCount: 0,
        githubCodeqlOpenLowAlertCount: 0,
        githubCodeqlOpenAlertCount: 1,
        githubCodeqlHasOpenCriticalAlerts: true,
        githubTrivyScanEnabled: true,
        githubTrivyOpenCriticalAlertCount: 1,
        githubTrivyOpenHighAlertCount: 22,
        githubTrivyOpenMediumAlertCount: 32,
        githubTrivyOpenLowAlertCount: 3,
        githubTrivyOpenAlertCount: 58,
        githubTrivyHasOpenCriticalAlerts: true,
      });
    });

    it('counts more than 100 alerts across pages', async () => {
      githubWithUploads({
        CodeQL: [],
        Trivy: [...alerts('high', 200), ...alerts('critical', 50)],
      });
      const [{ facts }] = await run();
      expect(facts.githubTrivyOpenAlertCount).toBe(250);
      expect(facts.githubTrivyOpenHighAlertCount).toBe(200);
      expect(facts.githubTrivyOpenCriticalAlertCount).toBe(50);
      expect(
        alertRequests().filter(path => path.includes('tool_name=Trivy')),
      ).toHaveLength(3);
    });

    it('counts a scanner that reports no security severity in its total only', async () => {
      githubWithUploads({ CodeQL: [], Trivy: alerts(null, 4) });
      const [{ facts }] = await run();
      expect(facts.githubTrivyOpenAlertCount).toBe(4);
      expect(facts.githubTrivyOpenCriticalAlertCount).toBe(0);
    });
  });

  describe('entities whose scanners cannot be read', () => {
    it('reports not enabled for a component with no repository', async () => {
      mockGetEntities.mockResolvedValue({ items: [component('a')] });
      const [{ facts }] = await run();
      expect(facts).toEqual(unresolved);
      expect(mockGetRepo).not.toHaveBeenCalled();
    });

    it.each([
      ['cannot find', 404],
      ['refuses', 403],
    ])(
      'reports the facts unresolved for a repository GitHub %s',
      async (_name, status) => {
        mockGetRepo.mockResolvedValue({ status });
        const [{ facts }] = await run();
        expect(facts).toEqual(unresolved);
      },
    );

    it.each([
      ['analyses', '/code-scanning/analyses'],
      ['alerts', '/code-scanning/alerts'],
    ])(
      'skips the entity rather than reporting it when %s answers 403',
      async (_name, failing) => {
        githubWithUploads({ CodeQL: [], Trivy: [] });
        const answer = mockGetRepo.getMockImplementation()!;
        mockGetRepo.mockImplementation(async (repository, path = '') =>
          path.startsWith(failing) ? { status: 403 } : answer(repository, path),
        );
        const ctx = context();
        await expect(run({}, ctx)).resolves.toEqual([]);
        expect(ctx.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('HTTP 403'),
        );
      },
    );

    it('skips the entity when alerts answer 404 after an analysis was found', async () => {
      githubWithUploads({ CodeQL: [], Trivy: [] });
      const answer = mockGetRepo.getMockImplementation()!;
      mockGetRepo.mockImplementation(async (repository, path = '') =>
        path.startsWith('/code-scanning/alerts?tool_name=Trivy')
          ? { status: 404 }
          : answer(repository, path),
      );
      const ctx = context();
      await expect(run({}, ctx)).resolves.toEqual([]);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Trivy code scanning alerts of org/a returned HTTP 404',
        ),
      );
    });

    it('skips the entity when the repository has no default branch', async () => {
      mockGetRepo.mockResolvedValue({ status: 200, body: {} });
      const ctx = context();
      await expect(run({}, ctx)).resolves.toEqual([]);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('returned no default branch'),
      );
      expect(mockGetRepo).toHaveBeenCalledTimes(1);
    });

    it('keeps the entity skipped if the second scanner fails after the first worked', async () => {
      githubWithUploads({ CodeQL: alerts('high', 1), Trivy: [] });
      const answer = mockGetRepo.getMockImplementation()!;
      mockGetRepo.mockImplementation(async (repository, path = '') =>
        path.includes('alerts?tool_name=Trivy')
          ? { status: 500 }
          : answer(repository, path),
      );
      await expect(run()).resolves.toEqual([]);
    });

    it('remembers where a rate limit stopped the run', async () => {
      const cache = mockServices.cache.mock();
      mockGetRepo.mockRejectedValue(new GithubRateLimitError(429));
      const results = await createGithubCodeScanningFactRetriever({
        cache,
        options: { schemaVersion: 1, tools: DEFAULT_CODE_SCANNING_TOOLS },
      }).handler(context());
      expect(results).toEqual([]);
      expect(cache.set).toHaveBeenCalledWith(
        'githubCodeScanningFactRetriever:cursor',
        'component:default/a',
        expect.anything(),
      );
    });
  });

  describe('configuration', () => {
    const semgrep = {
      id: 'semgrep',
      toolName: 'Semgrep OSS',
      label: 'Semgrep',
    };

    it('registers one retriever with a fixed id', () => {
      expect(retriever().id).toBe('githubCodeScanningFactRetriever');
      expect(retriever().entityFilter).toEqual([{ kind: 'component' }]);
    });

    it('starts at 0.1.0, like the other retrievers here', () => {
      expect(retriever().version).toBe('0.1.0');
    });

    it('takes its schema version from the configured version', () => {
      expect(retriever({ schemaVersion: 3 }).version).toBe('0.3.0');
    });

    it('supports another scanner through configuration alone', async () => {
      githubWithUploads({ 'Semgrep OSS': alerts('high', 2) });
      const options = { tools: [...DEFAULT_CODE_SCANNING_TOOLS, semgrep] };

      expect(
        retriever(options).schema.githubSemgrepOpenHighAlertCount,
      ).toMatchObject({
        type: 'integer',
        description: 'Open Semgrep alerts with security severity high',
      });

      const [{ facts }] = await run(options);
      expect(
        retriever(options).schema.githubCodeScanners.description,
      ).toContain('out of: codeql, trivy, semgrep.');
      expect(facts).toMatchObject({
        githubCodeScanners: ['semgrep'],
        githubSemgrepScanEnabled: true,
        githubSemgrepOpenHighAlertCount: 2,
        githubCodeqlScanEnabled: false,
        githubTrivyScanEnabled: false,
      });
      expect(mockGetRepo).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('tool_name=Semgrep%20OSS'),
      );
    });

    it('describes exactly the facts it reports', async () => {
      githubWithUploads({ CodeQL: [], Trivy: [] });
      const [{ facts }] = await run();
      expect(Object.keys(retriever().schema).sort()).toEqual(
        Object.keys(facts).sort(),
      );
    });
  });
});
