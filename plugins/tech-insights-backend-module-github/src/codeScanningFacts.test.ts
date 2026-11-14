import type { GithubApi } from './githubApi';
import type { GithubRepository } from './repository';
import {
  codeScannersSchema,
  codeScanningFacts,
  codeScanningSchema,
  factPrefix,
  hasCodeScanningAnalysis,
  listOpenCodeScanningAlerts,
} from './codeScanningFacts';

const repository = {
  owner: 'org',
  name: 'repo',
} as GithubRepository;

const alert = (severity: string | null) => ({
  rule: { security_severity_level: severity },
});

function apiReturning(...responses: Array<{ status: number; body?: any }>) {
  const getRepo = jest.fn();
  responses.forEach(r => getRepo.mockResolvedValueOnce(r));
  return { api: { getRepo } as GithubApi, getRepo };
}

describe('factPrefix', () => {
  it.each([
    ['trivy', 'githubTrivy'],
    ['codeql', 'githubCodeql'],
    ['snykCode', 'githubSnykCode'],
  ])('turns scanner id %s into %s', (id, prefix) => {
    expect(factPrefix(id)).toBe(prefix);
  });
});

describe('codeScanningFacts', () => {
  it('counts open alerts by severity under the scanner prefix', () => {
    expect(
      codeScanningFacts('codeql', [
        alert('critical'),
        alert('high'),
        alert('high'),
        alert('low'),
        alert(null),
      ]),
    ).toEqual({
      githubCodeqlScanEnabled: true,
      githubCodeqlOpenCriticalAlertCount: 1,
      githubCodeqlOpenHighAlertCount: 2,
      githubCodeqlOpenMediumAlertCount: 0,
      githubCodeqlOpenLowAlertCount: 1,
      githubCodeqlOpenAlertCount: 5,
      githubCodeqlHasOpenCriticalAlerts: true,
    });
  });

  it('counts alerts with no security severity only in the total', () => {
    expect(codeScanningFacts('semgrep', [alert(null), {}])).toMatchObject({
      githubSemgrepScanEnabled: true,
      githubSemgrepOpenCriticalAlertCount: 0,
      githubSemgrepOpenAlertCount: 2,
      githubSemgrepHasOpenCriticalAlerts: false,
    });
  });

  it('reports a clean scan with real zero values', () => {
    expect(codeScanningFacts('trivy', [])).toEqual({
      githubTrivyScanEnabled: true,
      githubTrivyOpenCriticalAlertCount: 0,
      githubTrivyOpenHighAlertCount: 0,
      githubTrivyOpenMediumAlertCount: 0,
      githubTrivyOpenLowAlertCount: 0,
      githubTrivyOpenAlertCount: 0,
      githubTrivyHasOpenCriticalAlerts: false,
    });
  });

  it('reports ScanEnabled: false and null counts when the tool never ran', () => {
    expect(codeScanningFacts('trivy', undefined)).toEqual({
      githubTrivyScanEnabled: false,
      githubTrivyOpenCriticalAlertCount: null,
      githubTrivyOpenHighAlertCount: null,
      githubTrivyOpenMediumAlertCount: null,
      githubTrivyOpenLowAlertCount: null,
      githubTrivyOpenAlertCount: null,
      githubTrivyHasOpenCriticalAlerts: null,
    });
  });
});

describe('listOpenCodeScanningAlerts', () => {
  it('filters by tool, open state and branch', async () => {
    const { api, getRepo } = apiReturning({ status: 200, body: [] });
    await listOpenCodeScanningAlerts(api, repository, 'Trivy', 'release/1.x');
    expect(getRepo).toHaveBeenCalledWith(
      repository,
      expect.stringMatching(
        /^\/code-scanning\/alerts\?tool_name=Trivy&state=open&ref=refs%2Fheads%2Frelease%2F1\.x&/,
      ),
    );
  });

  it('reads every page until a short one', async () => {
    const { api, getRepo } = apiReturning(
      { status: 200, body: Array(100).fill(alert('high')) },
      { status: 200, body: Array(100).fill(alert('low')) },
      { status: 200, body: Array(50).fill(alert('critical')) },
    );
    const alerts = await listOpenCodeScanningAlerts(
      api,
      repository,
      'Trivy',
      'main',
    );
    expect(alerts).toHaveLength(250);
    expect(getRepo).toHaveBeenCalledTimes(3);
    expect(getRepo).toHaveBeenLastCalledWith(
      repository,
      expect.stringContaining('per_page=100&page=3'),
    );
    expect(codeScanningFacts('trivy', alerts)).toMatchObject({
      githubTrivyOpenHighAlertCount: 100,
      githubTrivyOpenLowAlertCount: 100,
      githubTrivyOpenCriticalAlertCount: 50,
      githubTrivyOpenAlertCount: 250,
    });
  });

  it('stops on an empty page when the count is an exact multiple of 100', async () => {
    const { api, getRepo } = apiReturning(
      { status: 200, body: Array(100).fill(alert('high')) },
      { status: 200, body: [] },
    );
    const alerts = await listOpenCodeScanningAlerts(
      api,
      repository,
      'Trivy',
      'main',
    );
    expect(alerts).toHaveLength(100);
    expect(getRepo).toHaveBeenCalledTimes(2);
  });

  it('skips the entity when a later page fails, rather than undercounting', async () => {
    const { api } = apiReturning(
      { status: 200, body: Array(100).fill(alert('high')) },
      { status: 500 },
    );
    await expect(
      listOpenCodeScanningAlerts(api, repository, 'Trivy', 'main'),
    ).rejects.toThrow('HTTP 500');
  });

  it.each([403, 404])(
    'throws on HTTP %s so the entity is skipped, not reported clean',
    async status => {
      const { api } = apiReturning({ status });
      await expect(
        listOpenCodeScanningAlerts(api, repository, 'CodeQL', 'main'),
      ).rejects.toThrow(`HTTP ${status}`);
    },
  );

  it('throws when a page is not a list', async () => {
    const { api } = apiReturning({ status: 200, body: { message: 'x' } });
    await expect(
      listOpenCodeScanningAlerts(api, repository, 'CodeQL', 'main'),
    ).rejects.toThrow('returned no list');
  });
});

describe('hasCodeScanningAnalysis', () => {
  const ran = (...responses: Array<{ status: number; body?: any }>) =>
    hasCodeScanningAnalysis(
      apiReturning(...responses).api,
      repository,
      'Trivy',
      'main',
    );

  it('asks about the tool on the branch', async () => {
    const { api, getRepo } = apiReturning({ status: 200, body: [{}] });
    await hasCodeScanningAnalysis(api, repository, 'Snyk Code', 'release/1.x');
    expect(getRepo).toHaveBeenCalledWith(
      repository,
      '/code-scanning/analyses?tool_name=Snyk%20Code&ref=refs%2Fheads%2Frelease%2F1.x&per_page=1',
    );
  });

  it('is true when an analysis exists', async () => {
    await expect(ran({ status: 200, body: [{}] })).resolves.toBe(true);
  });

  it('is false on a 404', async () => {
    await expect(ran({ status: 404 })).resolves.toBe(false);
  });

  it('is false on an empty list', async () => {
    await expect(ran({ status: 200, body: [] })).resolves.toBe(false);
  });

  it.each([403, 500])('throws on HTTP %s', async status => {
    await expect(ran({ status })).rejects.toThrow(`HTTP ${status}`);
  });

  it('throws when the answer is not a list, rather than reporting never ran', async () => {
    await expect(ran({ status: 200, body: {} })).rejects.toThrow(
      'returned no list',
    );
  });
});

describe('codeScanningSchema', () => {
  const tool = { id: 'trivy', toolName: 'Trivy', label: 'Trivy scanner' };
  const schema = codeScanningSchema(tool);

  it('describes exactly the facts the tool reports', () => {
    expect(Object.keys(schema).sort()).toEqual(
      Object.keys(codeScanningFacts('trivy', [])).sort(),
    );
  });

  it('names each fact after the scanner id', () => {
    expect(Object.keys(schema).sort()).toEqual([
      'githubTrivyHasOpenCriticalAlerts',
      'githubTrivyOpenAlertCount',
      'githubTrivyOpenCriticalAlertCount',
      'githubTrivyOpenHighAlertCount',
      'githubTrivyOpenLowAlertCount',
      'githubTrivyOpenMediumAlertCount',
      'githubTrivyScanEnabled',
    ]);
  });

  it('describes each fact with the scanner label', () => {
    expect(schema.githubTrivyOpenCriticalAlertCount).toEqual({
      type: 'integer',
      description: 'Open Trivy scanner alerts with security severity critical',
    });
  });

  it('keeps each description within 512 characters', () => {
    Object.values(schema).forEach(field =>
      expect(field.description.length).toBeLessThanOrEqual(512),
    );
  });
});

describe('codeScannersSchema', () => {
  const tools = [
    { id: 'codeql', toolName: 'CodeQL', label: 'CodeQL' },
    { id: 'semgrep', toolName: 'Semgrep OSS', label: 'Semgrep' },
  ];

  it('is a list that names the configured scanners and the operators to use', () => {
    const { type, description } = codeScannersSchema(tools);
    expect(type).toBe('set');
    expect(description).toContain('out of: codeql, semgrep.');
    expect(description).toContain('use contains or doesNotContain');
  });

  it('keeps the description within 512 characters', () => {
    expect(codeScannersSchema(tools).description.length).toBeLessThanOrEqual(
      512,
    );
  });
});
