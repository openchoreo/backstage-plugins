import type { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import type { GithubApi, GithubApiResponse } from './githubApi';
import type { CodeScanningTool } from './options';
import type { GithubRepository } from './repository';

export interface CodeScanningAlert {
  rule?: { security_severity_level?: string | null };
}

// GitHub's maximum page size for the alerts listing.
const PAGE_SIZE = 100;

/**
 * A response the facts can't be read from. 403 is code scanning disabled or a
 * token without Code scanning alerts: read — the facts can't be determined, so
 * the entity is skipped rather than reported as never scanned or clean.
 */
function unreadable(
  request: string,
  repository: GithubRepository,
  { status, body }: GithubApiResponse,
): Error | undefined {
  if (status !== 200) {
    return new Error(
      `GET ${request} of ${repository.owner}/${repository.name} returned HTTP ${status}`,
    );
  }
  if (!Array.isArray(body)) {
    return new Error(
      `GET ${request} of ${repository.owner}/${repository.name} returned no list`,
    );
  }
  return undefined;
}

/**
 * Whether one tool has uploaded an analysis for a branch.
 *
 * This is what separates a tool that never ran from one that ran and found
 * nothing, which the alerts listing can't do: it answers 200 with an empty
 * list for a tool with no uploads when another tool has uploaded. This
 * endpoint answers such a tool with either a 404 or an empty list, so both
 * mean it never ran. `ref` keeps a scan of a pull request or another branch
 * from counting.
 */
export async function hasCodeScanningAnalysis(
  api: GithubApi,
  repository: GithubRepository,
  toolName: string,
  branch: string,
): Promise<boolean> {
  const response = await api.getRepo(
    repository,
    `/code-scanning/analyses?tool_name=${encodeURIComponent(
      toolName,
    )}&ref=${encodeURIComponent(`refs/heads/${branch}`)}&per_page=1`,
  );
  if (response.status === 404) {
    return false;
  }
  const error = unreadable(
    `${toolName} code scanning analyses`,
    repository,
    response,
  );
  if (error) {
    throw error;
  }
  return response.body.length > 0;
}

/**
 * Open GitHub Code Scanning alerts reported by one tool on a branch. Without
 * `ref` the listing reads the default branch. Read them only once
 * `hasCodeScanningAnalysis` is true for the same branch: an empty list doesn't
 * mean the tool ran, and a 404 (no analyses at all) contradicts that check, so
 * it's an error like any other.
 *
 * `toolName` is matched against the SARIF `tool.driver.name` of each upload,
 * and the listing has no `category` filter, so alerts from every upload of
 * the tool (e.g. every image in a scan matrix) arrive together.
 */
export async function listOpenCodeScanningAlerts(
  api: GithubApi,
  repository: GithubRepository,
  toolName: string,
  branch: string,
): Promise<CodeScanningAlert[]> {
  const alerts: CodeScanningAlert[] = [];
  for (let page = 1; ; page++) {
    const response = await api.getRepo(
      repository,
      `/code-scanning/alerts?tool_name=${encodeURIComponent(
        toolName,
      )}&state=open&ref=${encodeURIComponent(
        `refs/heads/${branch}`,
      )}&per_page=${PAGE_SIZE}&page=${page}`,
    );
    const error = unreadable(
      `${toolName} code scanning alerts`,
      repository,
      response,
    );
    if (error) {
      throw error;
    }
    const pageAlerts: CodeScanningAlert[] = response.body;
    alerts.push(...pageAlerts);
    if (pageAlerts.length < PAGE_SIZE) {
      return alerts;
    }
  }
}

/**
 * The fact listing the scanners that ran. Like every fact here it starts with
 * `github`, because jsonfc merges every retriever's facts into one namespace.
 */
export const CODE_SCANNERS_FACT = 'githubCodeScanners';

/** The start of one scanner's fact names: `trivy` gives `githubTrivy`. */
export function factPrefix(id: string): string {
  return `github${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

/**
 * The seven `github<Id>*` facts for one scanning tool. When the tool has never
 * run, or the component names no GitHub repository, `github<Id>ScanEnabled` is
 * false and every count is null, so checks fail the component instead of
 * skipping it. Alerts without a security severity (quality-only rules, or a
 * tool that reports none) count only towards `github<Id>OpenAlertCount`.
 */
export function codeScanningFacts(
  id: string,
  alerts: CodeScanningAlert[] | undefined,
): Record<string, boolean | number | null> {
  const prefix = factPrefix(id);
  if (!alerts) {
    return {
      [`${prefix}ScanEnabled`]: false,
      [`${prefix}OpenCriticalAlertCount`]: null,
      [`${prefix}OpenHighAlertCount`]: null,
      [`${prefix}OpenMediumAlertCount`]: null,
      [`${prefix}OpenLowAlertCount`]: null,
      [`${prefix}OpenAlertCount`]: null,
      [`${prefix}HasOpenCriticalAlerts`]: null,
    };
  }
  const count = (severity: string) =>
    alerts.filter(a => a.rule?.security_severity_level === severity).length;
  const critical = count('critical');
  return {
    [`${prefix}ScanEnabled`]: true,
    [`${prefix}OpenCriticalAlertCount`]: critical,
    [`${prefix}OpenHighAlertCount`]: count('high'),
    [`${prefix}OpenMediumAlertCount`]: count('medium'),
    [`${prefix}OpenLowAlertCount`]: count('low'),
    [`${prefix}OpenAlertCount`]: alerts.length,
    [`${prefix}HasOpenCriticalAlerts`]: critical > 0,
  };
}

type FactSchemaField = FactRetriever['schema'][string];

/**
 * The schema of the `githubCodeScanners` fact. It's a list because an entity
 * has one row of facts and a repository can have several scanners.
 */
export function codeScannersSchema(tools: CodeScanningTool[]): FactSchemaField {
  const ids = tools.map(tool => tool.id).join(', ');
  return {
    type: 'set',
    description: `The scanners that uploaded an analysis for the branch the component builds from (githubBranch), out of: ${ids}. A list, so use contains or doesNotContain. Empty when none ran; null when the component names no GitHub repository and branch the portal can read`,
  };
}

/** The schema of one tool's facts. */
export function codeScanningSchema(
  tool: CodeScanningTool,
): FactRetriever['schema'] {
  const { id, label } = tool;
  const prefix = factPrefix(id);
  const fact = (
    name: string,
    type: FactSchemaField['type'],
    description: string,
  ): [string, FactSchemaField] => [`${prefix}${name}`, { type, description }];
  const severityCount = (name: string, severity: string) =>
    fact(
      name,
      'integer',
      `Open ${label} alerts with security severity ${severity}`,
    );
  return Object.fromEntries([
    fact(
      'ScanEnabled',
      'boolean',
      `Whether ${label} has uploaded an analysis for the branch the component builds from (githubBranch). When false (it never ran there, or the component names no GitHub repository and branch the portal can read), every other fact is null`,
    ),
    severityCount('OpenCriticalAlertCount', 'critical'),
    severityCount('OpenHighAlertCount', 'high'),
    severityCount('OpenMediumAlertCount', 'medium'),
    severityCount('OpenLowAlertCount', 'low'),
    fact(
      'OpenAlertCount',
      'integer',
      `All open ${label} alerts on the branch the component builds from. The severity counts leave out alerts with no security severity, so use this fact for a scanner that doesn't report one`,
    ),
    fact(
      'HasOpenCriticalAlerts',
      'boolean',
      `Whether there is at least one open critical ${label} alert`,
    ),
  ]);
}
