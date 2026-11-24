# @openchoreo/backstage-plugin-tech-insights-backend-module-github

A Tech Insights fact retriever, `githubRepositoryFactRetriever`, that reads the GitHub repository
behind each Component and ReleaseLine and the protection of the branch it builds from, through the
GitHub REST API. A release line gets its own facts, so a line that builds from another branch is
judged on that branch's protection.

It reports whether the repository is archived, its visibility, the days since the last push,
whether the branch has a `CODEOWNERS` file and a `SECURITY.md`, and how the branch is protected:
whether it's protected at all, needs a pull request, approving reviews, code owner review or
status checks, and allows force pushes or deletion. Facts are prefixed with `github` because
jsonfc merges every retriever's facts into one namespace.

A `SECURITY.md` in the owner's public `.github` repository counts too, since GitHub shows it for
every repository without its own. `CODEOWNERS` has no such default.

`githubRepositoryResolved` is false when the component names no GitHub repository and branch the
portal can read, and every other fact is then left out, so jsonfc skips checks on them instead of
failing the component. A check that should fail such a component reads `githubRepositoryResolved`.
A component whose source isn't on GitHub resolves the same way. OpenChoreo writes a
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
hour, which covers only a few repositories. Components and release lines that share a repository
share its requests within a run, and a request that takes longer than 30 seconds skips that entity.

When a run hits the rate limit, it stops and the next run starts at the entity where it stopped.
That position is kept in the plugin cache, so with the default in-memory store it's per replica
and lost on restart, and the next run then starts from the first entity. If the cache can't be read
the run starts from the first entity too, and if it can't be written the previous position can stay,
so the next run may start there again.

## Configuration

The repository comes from the first entity annotation that resolves to a host under
`integrations.github`, by default `backstage.io/source-location`, then `github.com/project-slug`.
The branch comes from the first `branchAnnotations` entry present, by default
`openchoreo.io/branch`, where OpenChoreo records the build branch of a component or a release line.
Without one it's the ref in the repository URL, else the repository's default branch. A branch
name can contain `/`, so
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

Each scanner adds six facts, named after its `id`. For `codeql`:

| Fact                                                                     | Type    | Meaning                                              |
| ------------------------------------------------------------------------ | ------- | ---------------------------------------------------- |
| `githubCodeqlScanned`                                                    | boolean | Whether CodeQL uploaded an analysis for the branch   |
| `githubCodeqlOpenCriticalAlertCount` ... `githubCodeqlOpenLowAlertCount` | integer | Open alerts with each security severity              |
| `githubCodeqlOpenAlertCount`                                             | integer | All open alerts, with or without a security severity |

`githubCodeScanners` lists the ids of the scanners that ran. It's a list, so rules test it with
`contains` or `doesNotContain`, for example `githubCodeScanners contains codeql`.
`githubCodeScanningResolved`, like `githubRepositoryResolved`, says whether code scanning could be
read for the component at all.

A scanner that never ran on the branch reports its `Scanned` fact false and null counts, while one
that ran and found nothing reports real zeros. A check that needs the scanner to have run should
read `Scanned`, for example `githubCodeqlScanned equal true`: a `notEqual` on a count passes when
the count is null.

When code scanning can't be read for a component, only `githubCodeScanningResolved` is reported, as
false, and every other code scanning fact is left out, so jsonfc skips the checks on them instead of
failing the component. A check that should fail such a component reads `githubCodeScanningResolved`.
That covers a component that names no GitHub repository and branch the portal can read, and a
repository for which GitHub answers HTTP 403: code scanning is off (a private repository without
GitHub Code Security) or the credentials lack access to it. The two causes aren't told apart. Any
other error, such as a rate limit or a server error, skips the component, which keeps its previous
facts until they expire.

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

Only CodeQL is read by default. To add scanners, list every scanner, CodeQL included, and set
`schemaVersion` to 2 or more (1 is the schema of the default, so the backend fails to start on 1).
Trivy scanning the repository and Semgrep are examples of what can be added:

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

Trivy also scans container images, and those uploads are named `Trivy` too, so only add it if the
repository's workflows upload no image scans: otherwise their alerts are counted as findings in the
code.

`id` names the facts (`semgrep` gives `githubSemgrepOpenAlertCount`) and must start with a
lowercase letter and contain only letters and digits. `dependabot` and `secretScanning` are reserved
for the facts of GitHub's other security features. `toolName` is the tool's name as GitHub's code
scanning page shows it, and `label` is used in fact descriptions. The backend fails to start on an
invalid or reserved `id`, or on an `id` or `toolName` listed twice.
