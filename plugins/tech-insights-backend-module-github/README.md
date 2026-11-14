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

## GitHub Code Scanning

A second retriever, `githubCodeScanningFactRetriever`, reads GitHub Code Scanning for every
configured scanner: any tool whose SARIF results are uploaded to GitHub, such as CodeQL, Trivy or
Semgrep. It reads the same branch as `githubRepositoryFactRetriever`, chosen as described above, so
both describe the code the component builds from. A scan counts only when the scanner ran on that
branch, so a component that builds from a branch the scan workflow doesn't cover reports the
scanner as not run.

Each scanner adds seven facts, named after its `id`. For `trivy`:

| Fact                                                                   | Type    | Meaning                                              |
| ---------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| `githubTrivyScanEnabled`                                               | boolean | Whether Trivy uploaded an analysis for the branch    |
| `githubTrivyOpenCriticalAlertCount` ... `githubTrivyOpenLowAlertCount` | integer | Open alerts with each security severity              |
| `githubTrivyOpenAlertCount`                                            | integer | All open alerts, with or without a security severity |
| `githubTrivyHasOpenCriticalAlerts`                                     | boolean | Whether there is at least one open critical alert    |

`githubCodeScanners` lists the ids of the scanners that ran. It's a list, so rules test it with
`contains` or `doesNotContain`, for example `githubCodeScanners contains trivy`.

A scanner that never ran on the branch reports `ScanEnabled` false and null counts, while one that
ran and found nothing reports real zeros, so checks fail a component that isn't scanned instead of
passing it. A component that names no GitHub repository and branch the portal can read gets the
same null facts, with `githubCodeScanners` null. Any other error, such as code scanning being
disabled or credentials without access to it, skips the component, which keeps its previous facts
until they expire.

```yaml
techInsights:
  factRetrievers:
    githubCodeScanningFactRetriever:
      cadence: '0 */6 * * *'
      lifecycle: { timeToLive: { days: 3 } }
```

A component costs a request for the repository, one or more to find its branch, one per scanner to
ask whether it ran, and for each scanner that did, one per hundred open alerts (at least one).

The credentials need read access to code scanning alerts: the **Code scanning alerts** read
permission for a GitHub App or a fine-grained token, or the `security_events` scope for a classic
token (`public_repo` covers public repositories only). GitHub refuses code scanning requests without
credentials even for a public repository, answering HTTP 401, so every component is then skipped.

Scanners default to CodeQL and Trivy. To change them, list every scanner and raise `schemaVersion`:

```yaml
techInsights:
  github:
    codeScanning:
      # Increase whenever `tools` changes, and never lower it. Tech Insights keeps the schema it
      # already has for a version, so otherwise the change has no effect.
      schemaVersion: 2
      tools:
        - { id: codeql, toolName: CodeQL, label: CodeQL }
        - { id: trivy, toolName: Trivy, label: Trivy }
        - { id: semgrep, toolName: Semgrep OSS, label: Semgrep }
```

`id` names the facts (`semgrep` gives `githubSemgrepOpenAlertCount`) and must start with a
lowercase letter and contain only letters and digits. `toolName` is the tool's name as GitHub's code
scanning page shows it, and `label` is used in fact descriptions. The backend fails to start on an
invalid `id`, or on an `id` or `toolName` listed twice.
