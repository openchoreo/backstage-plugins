# @openchoreo/backstage-plugin-scaffolder-backend-module

Backstage scaffolder actions for [OpenChoreo](https://openchoreo.dev). Software
templates use them to create OpenChoreo control plane resources as part of a
self-service flow — no `kubectl` and no YAML in the developer's hands.

![Self-service actions](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/self-service-actions.png)

## Actions

Workload resources:

- `openchoreo:project:create`
- `openchoreo:component:create`
- `openchoreo:resource:create`
- `openchoreo:namespace:create`
- `openchoreo:environment:create`
- `openchoreo:deployment-pipeline:create`
- `openchoreo:notificationchannel:create`

Platform definitions (namespace-scoped and cluster-scoped):

- `openchoreo:projecttype-definition:create` / `openchoreo:clusterprojecttype-definition:create`
- `openchoreo:componenttype-definition:create` / `openchoreo:clustercomponenttype-definition:create`
- `openchoreo:resourcetype-definition:create` / `openchoreo:clusterresourcetype-definition:create`
- `openchoreo:trait-definition:create` / `openchoreo:clustertrait-definition:create`
- `openchoreo:componentworkflow-definition:create` / `openchoreo:clusterworkflow-definition:create`

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-scaffolder-backend-module
```

```ts title="packages/backend/src/index.ts"
backend.add(import('@openchoreo/backstage-plugin-scaffolder-backend-module'));
```

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
