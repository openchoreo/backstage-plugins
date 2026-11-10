# @openchoreo/backstage-plugin-tech-insights-backend-module-github

A Tech Insights fact retriever, `githubRepositoryFactRetriever`, that reads the GitHub repository
behind each Component and the protection of the branch it builds from, through the GitHub REST
API.

It reports whether the repository is archived, its visibility, the days since the last push,
whether the branch has a `CODEOWNERS` file and a `SECURITY.md`, and how the branch is protected:
whether it's protected at all, needs a pull request, approving reviews, code owner review or
status checks, and allows force pushes or deletion. Facts are prefixed with `github` because
jsonfc merges every retriever's facts into one namespace.

A `SECURITY.md` in the owner's public `.github` repository counts too, since GitHub shows it for
every repository without its own. `CODEOWNERS` has no such default.

`githubRepositoryResolved` is false when the component names no GitHub repository and branch the
portal can read, and every other fact is then null, so checks fail the component instead of
skipping it. A component whose source isn't on GitHub resolves the same way. OpenChoreo writes a
folder path into `backstage.io/source-location` only for hosts named `github` or `gitlab`, so a
GitHub Enterprise host such as `ghe.example.com` gets the bare repository URL. The branch still
comes from `openchoreo.io/branch`.

When only part of a repository can be read, the facts that depend on that part are left out and the
rest are still reported. jsonfc skips a check whose facts are missing. If the folder listings are
refused, the file facts are left out. If the branch protection settings or the rulesets are
refused, a setting is reported only when the readable source settles it alone. Requiring a pull
request and forbidding force pushes are examples, since the other source can't loosen them.

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
when one is configured, else the host's token. Without credentials GitHub allows 60 requests an
hour, which covers only a few repositories. Components that share a repository share its requests
within a run, and a request that takes longer than 30 seconds skips that component.

When a run hits the rate limit, it stops and the next run starts at the entity where it stopped.
That position is kept in the plugin cache, so with the default in-memory store it's per replica
and lost on restart, and the next run then starts from the first entity.

## Configuration

The repository comes from the first entity annotation that resolves to a host under
`integrations.github`, by default `backstage.io/source-location`, then `github.com/project-slug`.
The branch comes from the first `branchAnnotations` entry present, by default
`openchoreo.io/branch`, where OpenChoreo records a component's build branch. Without one it's the
ref in the repository URL, else the repository's default branch. A branch name can contain `/`, so
for a URL like `…/tree/feature/login/svc/` the retriever tries `feature`, then `feature/login`, and
so on, and uses the first that exists. To read the branch from the URL only:

```yaml
techInsights:
  github:
    branchAnnotations: []
```
