# @openchoreo/backstage-plugin-tech-insights-backend-module-github

## 1.4.0-m.3

### Minor Changes

- 02c5a87: Add a Tech Insights fact retriever for GitHub repositories. For each Component
  it reports whether the repository is archived, its visibility, the days since
  the last push, whether the branch has a `CODEOWNERS` file and a `SECURITY.md`,
  and how the branch is protected.
- 0522aa1: Report GitHub repository and branch protection facts for each ReleaseLine, read from the repository
  and branch the line builds from.

### Patch Changes

- de33470: Report only `githubRepositoryResolved: false` for a component whose GitHub repository or branch
  can't be read, instead of setting every other fact to null. Checks on those facts now skip the
  component instead of failing it.
