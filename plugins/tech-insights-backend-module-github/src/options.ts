import type { Config } from '@backstage/config';

export const DEFAULT_REPO_ANNOTATIONS = [
  'backstage.io/source-location',
  'github.com/project-slug',
];

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
      github?.getOptionalStringArray('branchAnnotations') ?? [],
  };
}
