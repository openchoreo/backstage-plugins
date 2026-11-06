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
       * repository's default branch.
       */
      branchAnnotations?: string[];
    };
  };
}
