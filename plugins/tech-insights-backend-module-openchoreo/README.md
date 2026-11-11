# @openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo

Tech Insights fact retrievers that read OpenChoreo state through the OpenChoreo API, using the
portal's service credentials (`openchoreo.auth`).

| Retriever                              | Entities                                | Facts                                                                                                                                                           |
| -------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openchoreoComponentTypeFactRetriever` | `ClusterComponentType`, `ComponentType` | Workload type, allowed and embedded traits, allowed workflows, validation rules, whether templates set limits, run as non-root or allow privileged containers   |
| `openchoreoDeploymentFactRetriever`    | `Component`                             | Image registry and whether it's pinned, external endpoints, secret-like plain env values, environments deployed to, production, ready and latest-release status |

Each retriever reports a `…Resolved` fact. When the entity has no matching OpenChoreo resource it
is false and every other fact is null, so checks fail the entity instead of skipping it. jsonfc
skips a check only when a fact it uses is missing. `notEqual`, `notIn` and `not` pass on null, so a
check written with them should also require the `…Resolved` fact.

The deployment facts cover only Components the OpenChoreo catalog provider created, the ones with
an `openchoreo.io/component` annotation. Other Components get no facts, so these checks show no
result for them. A component that hasn't been built yet has no Workload, so its image, endpoint and
secret facts are left out, but its deployment facts are still reported.

An image counts as pinned when it names a digest, or a tag other than one that conventionally
moves (`latest`, `main`, `master`, `dev`, `develop`, `edge`, `nightly`, `stable`, `staging`). The
secret count looks at the parts of each env var name between underscores, so `DB_PASS` counts and
`TOKEN_URL` or `PASSWORD_FILE` don't. It counts plain values in the Workload and in the
per-environment overrides of its active release bindings, each name once. OpenChoreo records a
component's latest release only when `autoDeploy` is on, so `openchoreoRunsLatestRelease` is left
out for components deployed by hand.

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
```

## Permissions

The component type facts need `clustercomponenttype:view` and `componenttype:view`. The Workload
facts (image registry and pinning, external endpoints, plain secret-like env values) need
`workload:view`.

The deployment facts (environments, production, ready, latest release) need three more grants:

- `releasebinding:view` on the component's `ns/<ns>/project/<project>/component/<name>` path
- `environment:view` on the component's `ns/<ns>` path, since OpenChoreo authorizes every
  environment in a namespace against that path
- `component:view` on the component, to read its latest release

The API returns a list the caller can only partly see as 200 with the visible items. A hidden
binding would look like no deployment, and a hidden production environment would look like no
production deployment. So the retriever reads the caller's authz profile and reports the
deployment facts only when both the `releasebinding:view` and the `environment:view` grants cover
their paths with no CEL condition and no denial at, above or below them. A control plane with
authorization turned off grants everything.

Without those grants the retriever reports the Workload facts alone and leaves the deployment
facts out rather than setting them to null. It does the same, and logs a warning, when it can't
read the component, its release bindings, or the namespace's authz profile and environments. This
is unlike an
unresolved component. jsonfc skips a check when a fact it uses is missing, so a check on
deployment facts has no result for that component. It neither passes nor fails, and the
component's tier is decided by its other checks. When a deployment check shows no result on
components that are deployed, grant the service credentials `releasebinding:view` on them and
`environment:view` on their namespace without conditions, along with `component:view`.
