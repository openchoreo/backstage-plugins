# @openchoreo/backstage-plugin-openchoreo-ci

Backstage frontend plugin that adds the **Build** tab to OpenChoreo component pages:
workflow and build runs, per-step status and logs, and manual build triggering.

![Build from the portal](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/build-from-the-portal.png)

This is an optional add-on to the OpenChoreo **Core** install
([`@openchoreo/backstage-plugin`](https://www.npmjs.com/package/@openchoreo/backstage-plugin)),
and needs the OpenChoreo build plane deployed in your cluster
(`./install.sh --with-build` on the k3d quick start).

## Installation

```bash
yarn workspace app add @openchoreo/backstage-plugin-openchoreo-ci
yarn workspace backend add \
  @openchoreo/backstage-plugin-openchoreo-ci-backend \
  @openchoreo/backstage-plugin-openchoreo-workflows-backend
```

Both backends are required. The tab triggers builds through the CI backend, but reads
the builds list and creates workflow runs through `openchoreo-workflows-backend`, so
installing only the CI backend leaves the tab unable to load.

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
