# @openchoreo/backstage-plugin-backend

The core Backstage **backend** plugin for [OpenChoreo](https://openchoreo.dev).

It mounts at `/api/openchoreo` and serves the OpenChoreo control plane to the
OpenChoreo frontend plugins — projects, components, environments, deployments,
promotions, workload configuration, secrets, and access control — attaching the
caller's identity provider token to each upstream call.

This plugin is required by [`@openchoreo/backstage-plugin`](https://www.npmjs.com/package/@openchoreo/backstage-plugin);
install the two together.

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-backend
```

```ts title="packages/backend/src/index.ts"
backend.add(import('@openchoreo/backstage-plugin-backend'));
```

`@openchoreo/openchoreo-client-node` and the other shared libraries are dependencies of
this package, so there is nothing else to install for it to work. You will separately
want `@openchoreo/openchoreo-auth` in your backend, because the IDP token middleware it
provides has to be wired into the root router by hand.

Configuration lives in two places, and they are not interchangeable. The control plane
URL goes in `openchoreo.baseUrl`, and `openchoreo.auth` holds the **service** client
credentials used for background work such as the catalog entity provider. The
**sign-in** client is separate, under `auth.providers.openchoreo-auth` — see
[`@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth`](https://www.npmjs.com/package/@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth).

**Full setup instructions** — including the IDP token middleware the plugin depends on:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## Documentation

- [Backstage plugins overview](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/overview/)
- [Troubleshooting](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/troubleshooting/)

## License

Apache-2.0
