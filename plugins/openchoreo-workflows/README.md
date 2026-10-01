# @openchoreo/backstage-plugin-openchoreo-workflows

Backstage frontend plugin for OpenChoreo **generic workflows** — platform-defined
workflows (beyond build/CI) that developers can browse, trigger, and inspect from the
portal, with run history on the relevant catalog entity.

This is an optional add-on to the OpenChoreo **Core** install
([`@openchoreo/backstage-plugin`](https://www.npmjs.com/package/@openchoreo/backstage-plugin)),
which provides the fetch, permission, and auth APIs this plugin uses to reach the
OpenChoreo backend.

## Installation

```bash
yarn workspace app add @openchoreo/backstage-plugin-openchoreo-workflows
yarn workspace backend add @openchoreo/backstage-plugin-openchoreo-workflows-backend
```

The backend half is required — it serves the workflow definitions and runs.

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
