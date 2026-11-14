export interface Config {
  techInsights?: {
    github?: {
      /**
       * Entity annotations naming the repository, tried in order; the first
       * whose value resolves to a host configured under
       * `integrations.github` is used. Values may be a location such as
       * `url:https://github.com/org/repo/tree/main/` or an `org/repo` slug,
       * which is assumed to be on github.com.
       * Defaults to `backstage.io/source-location`, then
       * `github.com/project-slug`.
       */
      repoAnnotations?: string[];
      /**
       * Entity annotations naming the branch to evaluate, tried in order.
       * When none is present the ref in the repository URL is used, else the
       * repository's default branch. Defaults to `openchoreo.io/branch`; an
       * empty list reads the branch from the URL only.
       */
      branchAnnotations?: string[];
      /**
       * The scanners githubCodeScanningFactRetriever collects, for any tool
       * whose SARIF results are uploaded to GitHub Code Scanning. Defaults to
       * CodeQL and Trivy.
       */
      codeScanning?: {
        /**
         * Increase this whenever `tools` changes, and never lower it.
         * tech-insights keeps the schema it already has for a version and
         * always uses the highest, so otherwise the change has no effect.
         * Required when `tools` is set.
         */
        schemaVersion?: number;
        /**
         * The scanners to collect. Each adds seven facts named after its
         * `id`, on top of the shared `githubCodeScanners` fact.
         */
        tools?: Array<{
          /**
           * Names the scanner's facts, e.g. `codeql` gives
           * `githubCodeqlOpenAlertCount`, and is its value in the
           * `githubCodeScanners` fact. Changing it renames the facts.
           */
          id: string;
          /** The full tool name, as GitHub's code scanning page shows it. */
          toolName: string;
          /** The name used in fact descriptions. */
          label: string;
        }>;
      };
    };
  };
}
