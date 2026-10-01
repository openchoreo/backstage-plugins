# @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy

Backstage permission backend module that delegates authorization decisions to
[OpenChoreo](https://openchoreo.dev).

Instead of maintaining a second permission model inside Backstage, the portal asks
OpenChoreo's role-based access control what the signed-in user may do, so the roles
your platform already defines govern what the portal shows and allows.

![Role-based access control](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/role-based-access-control.png)

This module is part of the OpenChoreo **Core** install. Its behavior is gated on the
`openchoreo.features.authz.enabled` flag, which defaults to `true` and must match how
your OpenChoreo cluster is deployed. A mismatch fails in both directions: enabled here
but not in the cluster makes tabs render "No permissions", while
`openchoreo.features.authz.enabled: false` — or an `app-config.yaml` with no
`openchoreo` block at all — installs an **allow-all** policy that authorizes every
request. Disabling authz therefore removes Backstage permission enforcement rather than
falling back to Backstage's own defaults; do it only deliberately.

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy
```

```ts title="packages/backend/src/index.ts"
backend.add(
  import(
    '@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy'
  ),
);
```

## Documentation

- [Permission policy](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/permission-policy/)
- [Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/)

## License

Apache-2.0
