# @openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo

Tech Insights fact retrievers that read OpenChoreo state through the OpenChoreo API, using the
portal's service credentials (`openchoreo.auth`).

| Retriever                              | Entities                                | Facts                                                                                                                                                         |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openchoreoComponentTypeFactRetriever` | `ClusterComponentType`, `ComponentType` | Workload type, allowed and embedded traits, allowed workflows, validation rules, whether templates set limits, run as non-root or allow privileged containers |

Each retriever reports a `…Resolved` fact. When the entity has no matching OpenChoreo resource it
is false and every other fact is null, so checks fail the entity instead of skipping it. jsonfc
skips a check only when a fact it uses is missing. `notEqual`, `notIn` and `not` pass on null, so a
check written with them should also require the `…Resolved` fact.

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
```

## Permissions

The service credentials need `clustercomponenttype:view` and `componenttype:view`.
