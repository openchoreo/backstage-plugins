# @openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo

Tech Insights fact retrievers that read OpenChoreo state through the OpenChoreo API, using the
portal's service credentials (`openchoreo.auth`).

| Retriever                              | Entities                                | Facts                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openchoreoComponentTypeFactRetriever` | `ClusterComponentType`, `ComponentType` | Workload type, allowed and embedded traits, allowed workflows, validation rules, whether templates set limits, run as non-root or allow privileged containers                     |
| `openchoreoDeploymentFactRetriever`    | `Component`, `ReleaseLine`              | One entry per environment the line is bound to: production, synced, ready and latest-release status, image registry and pinning, secret-like plain env values, external endpoints |
| `openchoreoBuildFactRetriever`         | `Component`, `ReleaseLine`              | Whether the last finished build succeeded, and the share of the last 20 that did                                                                                                  |
| `openchoreoAlertingFactRetriever`      | `Component`, `ReleaseLine`              | Configured alert rules, per bound environment: production, observability, alerts and incidents of the last 30 days, and whether every count was read                              |

The component type and deployment retrievers report `openchoreoComponentTypeResolved` and `openchoreoComponentResolved`. When the entity has no matching OpenChoreo resource it
is false and every other fact is null, so checks fail the entity instead of skipping it. jsonfc
skips a check only when a fact it uses is missing. `notEqual`, `notIn` and `not` pass on null, so a
check written with them should also require that fact.

The deployment facts cover only Components the OpenChoreo catalog provider created, the ones with
an `openchoreo.io/component` annotation. Other Components get no facts, so these checks show no
result for them.

A Component's deployment and build facts describe its main line. They come from the release
bindings and workflow runs that belong to no release line, and the component's latest release.
Each ReleaseLine entity gets the same facts for its own line, read from its bindings, the runs
labelled with its name and its latest release. A line that runs in production therefore doesn't
make its component count as deployed to production.

### Environment deployments

`openchoreoEnvironmentDeployments` is a list with one entry per active release binding of the line
(bindings set to `Undeploy` are left out). Each entry has these fields:

| Field                        | Meaning                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `environment`                | Environment name                                                                                          |
| `isProduction`               | The environment's `spec.isProduction`                                                                     |
| `isReleaseSynced`            | The release has synced to the data plane (`ReleaseSynced`)                                                |
| `isReady`                    | The binding reports `Ready`                                                                               |
| `isOnLatestRelease`          | The binding is on the line's latest release                                                               |
| `plainTextSecretEnvVarCount` | Secret-like env vars holding a plain value, in the released Workload and the binding's overrides          |
| `isImagePinned`              | The released image names a digest, or a tag that doesn't conventionally move                              |
| `imageRegistry`              | Registry host of the released image, `docker.io` when the image names none                                |
| `externalEndpointCount`      | Endpoints the line owns with `external` visibility that have an EndpointReleaseBinding in the environment |

A check selects entries with its condition's `path` and judges each one with json-rules-engine's
`everyFact:` or `someFact:` operators, so it never names an environment. For example, every
production environment is ready:

```json
{
  "fact": "openchoreoEnvironmentDeployments",
  "path": "$[?(@.isProduction)].isReady",
  "operator": "everyFact:equal",
  "value": true
}
```

`everyFact` fails when the path selects nothing, such as a line with no production environment, or
a field left out of every entry. Wrap the condition in `any` with one that passes in that case,
such as `{ "path": "$[*].isProduction", "operator": "everyFact:equal", "value": false }`, when
that should pass.

A line with no active binding gets no `openchoreoEnvironmentDeployments`, so its checks on the list
show no result rather than failing. The image, secret and endpoint fields come from other
resources, and a field whose source can't be read is left out of its entry rather than set to
null:

- `plainTextSecretEnvVarCount`, `isImagePinned` and `imageRegistry` come from the ComponentRelease
  the binding points at (`spec.releaseName`), whose `spec.workload` is the Workload frozen with the
  image built for that release. An environment that lags behind therefore reports the image of the
  release it's bound to, though nothing confirms that image is running, for example when
  `isReleaseSynced` is false. They are left out when the ComponentRelease can't be read, and
  `imageRegistry` also when the release names no image. A path such as `$[*].isImagePinned`
  selects nothing for an environment that leaves a field out, so on its own a check on it covers
  only the environments that report it. The `openchoreoReleasesResolved` fact is true when the
  ComponentRelease of every binding that renders its release was read, and is left out otherwise:
  when any of those releases can't be read, when such a binding names no release, when every
  binding is in `Observe` mode, and whenever `openchoreoEnvironmentDeployments` is left out. Add
  `{ "fact": "openchoreoReleasesResolved", "operator": "equal", "value": true }` to the `all` of a
  check on `plainTextSecretEnvVarCount` or `isImagePinned`, as the starter checks do, so a line with an environment whose release
  couldn't be read shows no result instead of being judged on its other environments.
- `isOnLatestRelease` is left out when OpenChoreo records no latest release, which it does for a
  component or release line only when `autoDeploy` is on for it.
- `externalEndpointCount` is left out when the line's Endpoints or their bindings can't be read.
- An `Observe` binding reads objects the component already runs instead of rendering its release.
  The OpenChoreo API doesn't return a binding's mode, so `Observe` bindings are described like
  `Manage` ones, from the release they name. A binding the API reports in `Observe` mode leaves
  out `isOnLatestRelease`, `plainTextSecretEnvVarCount`, `isImagePinned` and `imageRegistry`, and
  keeps `isReleaseSynced`, `isReady` and `externalEndpointCount`.

An image counts as pinned when it names a digest, or a tag other than one that conventionally
moves (`latest`, `main`, `master`, `dev`, `develop`, `edge`, `nightly`, `stable`, `staging`). The
secret count looks at the parts of each env var name between underscores, so `DB_PASS` counts and
`TOKEN_URL` or `PASSWORD_FILE` don't, and counts each name once. `isReleaseSynced` is always
present, and is false for a binding whose release is missing, failed to render or has nowhere to
go.
`isOnLatestRelease` doesn't consider readiness, which `isReady` reports.

A run counts toward the build facts once it has finished, and one that failed validation before its
workflow ran counts as failed.
`openchoreoBuildSuccessRate` covers the newest 20 finished runs. OpenChoreo deletes a run a while
after it finishes (`ttlAfterCompletion`, one day in the sample workflows), so both facts are left
out when no finished run is retained, as they are for components built outside OpenChoreo and for
Components OpenChoreo doesn't manage. Checks on them then show no result rather than failing.

Trait and workflow facts are `Kind/name` values such as `ClusterTrait/observability`, since a
Trait and a ClusterTrait can share a name. A reference without a kind gets the CRD default: `Trait`
in a ComponentType, `ClusterTrait` in a ClusterComponentType, and `ClusterWorkflow` for workflows.
The validation rule count adds up `validations`, `preRenderValidations` and
`postRenderValidations`.

The container facts check only what a component type fixes when it's defined. A template's kind,
pod spec, container list or a container written as a CEL expression is decided per component, so
it's skipped here. Those values need checking at the component level. Inside a container that's
written out, a limit that calls `oc_omit()` doesn't count as set. A `securityContext` written as one
expression counts as allowing privileged containers and not enforcing non-root, the same as
writing those fields as expressions.

These facts read the component type's own templates. Patches that embedded traits apply to them
aren't considered. A type with no pod template, a proxy for example, reports false for limits and
non-root. Each run gets the service token once and fails if that doesn't work, rather than carrying
on unauthenticated.

### Alerts and incidents

`openchoreoAlertingFactRetriever` reports these facts for a Component's main line and for each
ReleaseLine:

- `openchoreoAlertingResolved`: whether the component, and for a ReleaseLine the line, exists in
  OpenChoreo. Unlike the `…Resolved` facts above, when it is false every other alerting fact is
  left out rather than set to null, so checks on them show no result.
- `openchoreoConfiguredAlertRuleCount`: trait instances whose Trait or ClusterTrait creates an
  `ObservabilityAlertRule`, counted over the Component's traits, the traits its component type
  embeds and, for a release line, the line's own traits. A line trait with the same kind, name and
  instance name as a Component trait is merged into it by OpenChoreo, so it isn't counted twice. The
  count is of configured rules. A rule that doesn't render in an environment, such as one under an
  `Observe` binding, still counts.
- `openchoreoEnvironmentAlerts`: a list with one entry per environment the line has an active
  release binding in.
- `openchoreoAlertCountsResolved`: true when every entry of `openchoreoEnvironmentAlerts` with
  observability holds all five counts, and at least one entry has observability. It is never
  false. It is left out whenever a count it covers is missing, so a check that requires it shows no
  result instead of judging partial counts.

| Field                               | Meaning                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `environment`                       | Environment name                                              |
| `isProduction`                      | The environment's `spec.isProduction`                         |
| `hasObservability`                  | An observer serves the environment through its data plane     |
| `alertsFiredLast30Days`             | Alerts fired                                                  |
| `criticalAlertsLast30Days`          | Alerts fired by a rule with `critical` severity               |
| `incidentsLast30Days`               | Incidents triggered                                           |
| `openIncidentsLast30Days`           | Incidents triggered that are still `active` or `acknowledged` |
| `unacknowledgedIncidentsLast30Days` | Incidents triggered that are still `active`                   |

The counts cover the 30 days before each run, the longest window the observer accepts. An incident
triggered earlier is not counted, even while it is still open. Each environment is queried on its
own, scoped to the component, and for a ReleaseLine to that line, so a Component's counts cover its
main line only. A query that gets no answer within 10 seconds leaves its counts out, and an observer
that times out or can't be reached isn't queried again until the next run, so it can't hold up
every entity.

A check selects entries with its condition's `path` and judges each with `everyFact:` or
`someFact:`. For example, no production environment has an unacknowledged incident:

```json
{
  "all": [
    {
      "fact": "openchoreoAlertCountsResolved",
      "operator": "equal",
      "value": true
    },
    {
      "fact": "openchoreoEnvironmentAlerts",
      "path": "$[?(@.isProduction)].unacknowledgedIncidentsLast30Days",
      "operator": "everyFact:equal",
      "value": 0
    }
  ]
}
```

A count that can't be determined is left out of its entry, and the path selects only the counts
that are there. Without the `openchoreoAlertCountsResolved` condition, the check would pass on the
environments that returned counts, even when the observer of another refused or failed the query.
With it, the check shows no result until every observed environment has its counts.
Environments without observability don't hold it back, so it doesn't show that production is
observed. A check that needs that should also select on `hasObservability`.

`everyFact` fails when the path selects nothing, such as a line with no production environment, or
a field left out of every selected entry. Wrap the count condition in `any` with one that passes in
that case, such as `{ "fact": "openchoreoEnvironmentAlerts", "path": "$[*].isProduction", "operator": "everyFact:equal", "value": false }`,
when that should pass, and keep the `openchoreoAlertCountsResolved` condition outside the `any`.

Facts are left out rather than guessed:

- `openchoreoEnvironmentAlerts` is left out for a line with no active binding, so its checks show
  no result, when the service credentials can't see every binding and environment (see
  Permissions), and when the release bindings or the namespace's authz profile can't be read.
- `openchoreoConfiguredAlertRuleCount` is left out when a trait or the component type can't be
  read. A trait or component type that doesn't exist adds nothing.
- `isProduction` and `hasObservability` are false when the Environment doesn't exist, and left
  out when it can't be read. The observer is found the way OpenChoreo renders alert rules: an Environment without a
  `dataPlaneRef` uses the namespace's `default` DataPlane, or the cluster's `default`
  ClusterDataPlane when the namespace has none, and a plane without an `observabilityPlaneRef`
  uses the `default` ObservabilityPlane the same way (a ClusterDataPlane only the cluster's).
  `hasObservability` is false when every plane that could apply doesn't exist, or the one found
  names no observer, and left out when a plane can't be read.
- The counts are left out of an entry without observability, and when its observer refuses or fails
  the query, or doesn't know the component or line yet.
- The observer returns at most 1000 alerts or incidents per query, so `criticalAlertsLast30Days`,
  `openIncidentsLast30Days` and `unacknowledgedIncidentsLast30Days` are left out when a query
  returns 1000 items (the observer's cap) or fewer than its total. The totals are still reported.
- `openchoreoAlertCountsResolved` is left out when an entry with observability misses any count
  for the reasons above, when an entry's `hasObservability` is left out, when no entry has
  observability, and whenever `openchoreoEnvironmentAlerts` is left out.

The facts hold only counts. They are computed with the portal's service credentials and readable
by everyone who can see the entity's scorecard, so incident notes and descriptions, and alert rule
queries, are never stored. They are logged only when an operator turns on the OpenChoreo client's
request tracing (`CHOREO_CLIENT_TRACE_ENABLED`), which logs every response body.

## Installation

```ts
backend.add(
  import(
    '@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo'
  ),
);
```

Tech Insights only schedules retrievers listed under `techInsights.factRetrievers`:

```yaml
techInsights:
  factRetrievers:
    openchoreoComponentTypeFactRetriever:
      cadence: '0 * * * *'
      lifecycle: { timeToLive: { days: 1 } }
    openchoreoDeploymentFactRetriever:
      cadence: '*/15 * * * *'
      lifecycle: { timeToLive: { hours: 6 } }
    openchoreoBuildFactRetriever:
      cadence: '*/30 * * * *'
      lifecycle: { timeToLive: { hours: 6 } }
    openchoreoAlertingFactRetriever:
      cadence: '*/30 * * * *'
      lifecycle: { timeToLive: { hours: 6 } }
```

## Permissions

The component type facts need `clustercomponenttype:view` and `componenttype:view`.

The deployment retriever needs `workload:view` on a component to read the Workload it names, which
tells a deleted component (`openchoreoComponentResolved` false) from one that is only undeployed.
`openchoreoEnvironmentDeployments` needs three more grants:

- `releasebinding:view` on the component's `ns/<ns>/project/<project>/component/<name>` path
- `environment:view` on the component's `ns/<ns>` path, since OpenChoreo authorizes every
  environment in a namespace against that path
- `component:view` on the component to read its latest release, and `releaseline:view` to read a
  release line's latest release

The API returns a list the caller can only partly see as 200 with the visible items. A hidden
binding would look like no deployment, and a hidden production environment would look like a
non-production one. So the retriever reads the caller's authz profile and reports
`openchoreoEnvironmentDeployments` only when both the `releasebinding:view` and the
`environment:view` grants cover their paths with no CEL condition and no denial at, above or below
them. A control plane with authorization turned off grants everything.

Without those grants the retriever leaves `openchoreoEnvironmentDeployments` out rather than
setting it to null. It does the same, and logs a warning, when it can't read the component or
release line, its release bindings, or the namespace's authz profile and environments. This is
unlike an unresolved component. jsonfc skips a check when a fact it uses is missing, so a check on
the list has no result for that component. It neither passes nor fails, and the component's tier
is decided by its other checks. When a deployment check shows no result on components that are
deployed, grant the service credentials `releasebinding:view` on them and `environment:view` on
their namespace without conditions, along with `component:view`.

The entry fields that come from other resources need their own grants, and are left out of every
entry without them:

- `plainTextSecretEnvVarCount`, `isImagePinned` and `imageRegistry` need `componentrelease:view` on
  the component. When the authz profile can't grant it, the retriever doesn't read ComponentReleases
  and logs one warning per run naming the grant. A grant under a CEL condition is tried, and a 403
  is handled the same way.
- `externalEndpointCount` needs `endpoint:view` and `endpointreleasebinding:view` on the project's
  `ns/<ns>/project/<project>` path, where OpenChoreo authorizes Endpoints and their bindings, with
  no CEL condition and no denial at, above or below it. A narrower grant would hide Endpoints and
  count them as none.

Without `componentrelease:view`, `openchoreoReleasesResolved` is left out too, so checks that
require it next to these fields, such as the starter checks on plain secrets and pinned images,
show no result on every deployed component until the grant is added. A check on these fields that
doesn't require it fails instead, since `everyFact` fails when every entry leaves the field out.

The build facts need `workflowrun:view` on the component's path, granted without conditions. The
run list returns only the runs the credentials can see, so without the grant the facts are left
out, and with a grant limited by a CEL condition they describe only the runs it lets through. A
failed read of the run list skips the component for that run, so it keeps its previous build facts
until they expire. A component with more than 500 retained runs gets no build facts.

The alerting facts need `component:view`, `releaseline:view`, `componenttype:view` or
`clustercomponenttype:view`, `trait:view` and `clustertrait:view` for the rule count, and
`releasebinding:view`, `environment:view`, `dataplane:view` or `clusterdataplane:view`, and
`observabilityplane:view` or `clusterobservabilityplane:view` to find each environment's observer.
The counts need `alerts:view` and `incidents:view` on the component. Without them the observer refuses the queries, the
counts are left out, and the retriever logs one warning per run naming the grants.

A binding list the caller can only partly see comes back as 200 with the visible bindings, so a
hidden environment would be missing from `openchoreoEnvironmentAlerts` and an `everyFact` check
would pass without it. Like the deployment retriever, the alerting retriever reads the caller's
authz profile once per namespace per run and reports the list only when `releasebinding:view` on
the component's `ns/<ns>/project/<project>/component/<name>` path and `environment:view` on its
`ns/<ns>` path are granted with no CEL condition and no denial at, above or below them. Otherwise
the list is left out and the resolved fact and the rule count are still reported. A profile that
can't be read leaves the list out with a warning, and the next entity in the namespace tries again.
