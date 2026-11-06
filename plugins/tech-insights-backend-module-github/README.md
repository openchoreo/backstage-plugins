# @openchoreo/backstage-plugin-tech-insights-backend-module-github

A Tech Insights fact retriever, `githubRepositoryFactRetriever`, that reads the GitHub repository
behind each Component and the protection of the branch it builds from, through the GitHub REST
API.

It reports whether the repository is archived, its visibility, the days since the last push,
whether the branch has a `CODEOWNERS` file and a `SECURITY.md`, and how the branch is protected:
whether it's protected at all, needs a pull request, approving reviews, code owner review or
status checks, and allows force pushes or deletion. Facts are prefixed with `github` because
jsonfc merges every retriever's facts into one namespace.

`githubRepositoryResolved` is false when the component names no GitHub repository and branch the
portal can read, and every other fact is then null, so checks fail the component instead of
skipping it.

## Installation

```ts
backend.add(
  import('@openchoreo/backstage-plugin-tech-insights-backend-module-github'),
);
```

Tech Insights only schedules retrievers listed under `techInsights.factRetrievers`:

```yaml
techInsights:
  factRetrievers:
    githubRepositoryFactRetriever:
      cadence: '0 2 * * *'
      lifecycle: { timeToLive: { days: 7 } }
```

Credentials come from `integrations.github`: a GitHub App installation for the repository owner
when one is configured, else the host's token. When a run hits the rate limit, it stops and the
next run starts at the entity where it stopped.

## Configuration

The repository comes from the first entity annotation that resolves to a host under
`integrations.github`, by default `backstage.io/source-location`, then `github.com/project-slug`.
The branch comes from the first `branchAnnotations` entry present (none by default), else the ref
in the repository URL, else the repository's default branch. OpenChoreo records a component's
build branch apart from its repository URL:

```yaml
techInsights:
  github:
    branchAnnotations: [openchoreo.io/branch]
```
