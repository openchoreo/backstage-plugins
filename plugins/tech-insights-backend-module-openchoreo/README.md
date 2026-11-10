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

The container facts check only what a component type fixes when it's defined. A template's kind,
pod spec, container list, a container or its `securityContext` written as a CEL expression is
decided per component, so it's skipped here. Those values need checking at the component level.

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
