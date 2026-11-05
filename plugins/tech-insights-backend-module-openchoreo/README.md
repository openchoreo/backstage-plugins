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

The service credentials need `clustercomponenttype:view`, `componenttype:view`, `component:view`,
`workload:view` and `environment:view`. The deployment facts (environments, production, ready,
latest release) also need `releasebinding:view` on the component. The API returns a list the
caller can only partly see as 200 with the visible items, so the retriever reads the caller's
authz profile and reports these facts only when the grant covers the component's
`namespace/<ns>/project/<project>/component/<name>` path with no CEL condition and no denial at,
above or below it. A control plane with authorization turned off grants everything.

Without that grant the retriever reports the Workload facts alone and leaves the deployment facts
out rather than setting them to null. This is unlike an unresolved component. jsonfc skips a
check when a fact it uses is missing, so a check on deployment facts has no result for that
component. It neither passes nor fails, and the component's tier is decided by its other checks.
When a deployment check shows no result on components that are deployed, grant the service
credentials `releasebinding:view` on them.
