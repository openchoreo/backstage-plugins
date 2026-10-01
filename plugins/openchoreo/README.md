# @openchoreo/backstage-plugin

The core Backstage frontend plugin for [OpenChoreo](https://openchoreo.dev) — an
open-source internal developer platform built on Kubernetes.

Install it into your own Backstage app to turn the software catalog into a control
surface for OpenChoreo: see how a system is wired together, deploy and promote a
component across environments, and manage access — without leaving the portal.

![OpenChoreo component page in Backstage](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/hero-home.png)

## What you get

Once installed, OpenChoreo-owned catalog entities gain these tabs and cards:

- **Cell** — an architecture diagram of a system: its components, the endpoints they
  expose, and the connections between them, rendered from the live control plane.
  ![Application architecture graph](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/application-architecture-graph.png)
- **Deploy** — per-environment deployment status for a component, with promotion
  between environments, workload configuration (containers, endpoints, dependencies),
  and per-environment overrides.
  ![Deploy and promote across environments](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/deploy-and-promote.png)
- **Definition** — the underlying OpenChoreo resource YAML, for when you want to see
  exactly what the portal is driving.
- **Access control** and **Secrets** — role bindings and secret references for a
  project or component.
- **Overview cards** for environments, data planes, deployment pipelines, component
  types, and the other platform entities OpenChoreo puts in the catalog.

Optional add-on plugins layer more tabs on top of this one — build/CI runs
(`@openchoreo/backstage-plugin-openchoreo-ci`), runtime logs, metrics, traces and cost
insights (`@openchoreo/backstage-plugin-openchoreo-observability`), generic workflow
runs (`@openchoreo/backstage-plugin-openchoreo-workflows`), and a platform-wide view
for platform engineers (`@openchoreo/backstage-plugin-platform-engineer-core`).

## Requirements

- A running OpenChoreo control plane (a local `k3d` install is enough — see the
  [OpenChoreo quick start](https://openchoreo.dev/docs/getting-started/quick-start-guide/)).
- A Backstage app on a supported release — see the
  [compatibility matrix](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/compatibility-matrix/).
- Node.js 22 or 24.

## Installation

This plugin is the frontend half of the OpenChoreo **Core** install. It does not work
on its own: you also need the backend plugin and a few backend modules, which together
serve the control-plane data and sync OpenChoreo entities into the catalog.

```bash
# frontend
yarn workspace app add @openchoreo/backstage-plugin

# backend
yarn workspace backend add \
  @openchoreo/backstage-plugin-backend \
  @openchoreo/backstage-plugin-catalog-backend-module \
  @openchoreo/backstage-plugin-scaffolder-backend-module \
  @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth \
  @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy \
  @openchoreo/openchoreo-auth
```

That is the minimal set: each package your own code imports, and nothing more. The
shared libraries — `@openchoreo/backstage-plugin-react`,
`@openchoreo/backstage-plugin-common`, `@openchoreo/backstage-design-system`,
`@openchoreo/cell-diagram`, `@openchoreo/openchoreo-client-node` — are ordinary
dependencies of the packages above, so your package manager installs them for you. Add
one of them explicitly only if you import from it directly.

The backend list is longer than the frontend's because each entry is named in your
`packages/backend/src/index.ts` — the modules in a `backend.add(...)` call, and
`@openchoreo/openchoreo-auth` for the IDP token middleware. (Backend feature discovery
can replace most of that wiring; see the repository README.)

All `@openchoreo/*` packages release together with matching versions — keep them on the
same version line.

On the **new frontend system** (the default `create-app` scaffold) the plugin is added
as a feature and every tab and card auto-mounts — no `EntityPage.tsx` edits:

```ts title="packages/app/src/App.tsx"
import openchoreoPluginAlpha from '@openchoreo/backstage-plugin/alpha';

export const app = createApp({
  features: [openchoreoPluginAlpha /* , ... */],
});
```

The backend plugins are wired with `backend.add(...)`, and the control plane and
identity provider are configured under an `openchoreo:` block in `app-config.yaml`.

**Follow the full guide for the remaining steps** — backend wiring, `app-config`,
sign-in, the auth/authz feature flags that must match your cluster, and the legacy
frontend system fallback:

👉 **[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/)**

## Documentation

- [Backstage plugins overview](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/overview/)
- [Entity views](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/entity-views/)
- [Catalog sync](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/catalog-sync/)
- [Permission policy](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/permission-policy/)
- [Troubleshooting](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/troubleshooting/)

## Local development

This plugin lives in the [openchoreo/backstage-plugins](https://github.com/openchoreo/backstage-plugins)
monorepo. From the repository root, `yarn start` runs the example app with the plugin
mounted; `yarn start` inside this directory serves the plugin in isolation against the
fixtures in [`./dev`](./dev).

## License

Apache-2.0
