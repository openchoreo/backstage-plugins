import type { Config } from '@backstage/config';

export const DEFAULT_REPO_ANNOTATIONS = [
  'backstage.io/source-location',
  'github.com/project-slug',
];

/** Where the OpenChoreo catalog provider records a component's build branch. */
export const DEFAULT_BRANCH_ANNOTATIONS = ['openchoreo.io/branch'];

export interface GithubFactsOptions {
  /** Entity annotations naming the repository, tried in order. */
  repoAnnotations: string[];
  /** Entity annotations naming the branch to evaluate, tried in order. */
  branchAnnotations: string[];
}

export function readGithubFactsOptions(config: Config): GithubFactsOptions {
  const github = config.getOptionalConfig('techInsights.github');
  return {
    repoAnnotations:
      github?.getOptionalStringArray('repoAnnotations') ??
      DEFAULT_REPO_ANNOTATIONS,
    branchAnnotations:
      github?.getOptionalStringArray('branchAnnotations') ??
      DEFAULT_BRANCH_ANNOTATIONS,
  };
}

/** A scanner whose SARIF results are uploaded to GitHub Code Scanning. */
export interface CodeScanningTool {
  /**
   * Names the scanner's facts (`trivy` gives `githubTrivyOpenAlertCount`), and
   * is its value in the `githubCodeScanners` fact.
   */
  id: string;
  /** The tool's name in GitHub Code Scanning, sent as `tool_name`. */
  toolName: string;
  /** The name people see. */
  label: string;
}

export interface CodeScanningOptions {
  schemaVersion: number;
  tools: CodeScanningTool[];
}

export const DEFAULT_CODE_SCANNING_TOOLS: CodeScanningTool[] = [
  { id: 'codeql', toolName: 'CodeQL', label: 'CodeQL' },
  { id: 'trivy', toolName: 'Trivy', label: 'Trivy' },
];

const SCANNER_ID = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Reads the configured scanners. Config that would produce unusable fact
 * names, or two scanners reading the same alerts, fails the backend's startup
 * rather than surfacing later as checks that never pass.
 */
export function readCodeScanningOptions(config: Config): CodeScanningOptions {
  const section = config.getOptionalConfig('techInsights.github.codeScanning');
  const configured = section?.getOptionalConfigArray('tools');
  const tools =
    configured?.map(tool => ({
      id: tool.getString('id'),
      toolName: tool.getString('toolName'),
      label: tool.getString('label'),
    })) ?? DEFAULT_CODE_SCANNING_TOOLS;
  // tech-insights keeps the schema it already has for a version, so a list
  // that changed without a new version would never take effect.
  const schemaVersion = configured
    ? section!.getNumber('schemaVersion')
    : section?.getOptionalNumber('schemaVersion') ?? 1;

  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error(
      `techInsights.github.codeScanning.schemaVersion must be a positive whole number, got ${schemaVersion}`,
    );
  }
  if (tools.length === 0) {
    throw new Error(
      'techInsights.github.codeScanning.tools must list at least one scanner',
    );
  }
  const ids = new Set<string>();
  const toolNames = new Set<string>();
  for (const { id, toolName } of tools) {
    if (!SCANNER_ID.test(id)) {
      throw new Error(
        `Scanner id '${id}' must start with a lowercase letter and contain only letters and digits, because it is part of fact names`,
      );
    }
    if (ids.has(id)) {
      throw new Error(`Scanner id '${id}' is listed more than once`);
    }
    ids.add(id);
    // GitHub matches tool_name ignoring case, so these would be the same scanner.
    const key = toolName.toLocaleLowerCase('en-US');
    if (toolNames.has(key)) {
      throw new Error(
        `Scanner toolName '${toolName}' is listed more than once`,
      );
    }
    toolNames.add(key);
  }
  return { schemaVersion, tools };
}
