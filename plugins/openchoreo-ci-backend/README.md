# openchoreo-ci-backend

Backend plugin for OpenChoreo CI/Workflow functionality. This plugin provides backend APIs for:

- Fetching workflow runs and their details
- Triggering builds
- Managing workflow configuration/parameters
- Fetching build logs

## Installation

This plugin is installed via the `@openchoreo/backstage-plugin-openchoreo-ci-backend` package. To install it to your backend package, run the following command:

```bash
# From your root directory
yarn --cwd packages/backend add @openchoreo/backstage-plugin-openchoreo-ci-backend
```

Then add the plugin to your backend in `packages/backend/src/index.ts`:

```ts
const backend = createBackend();
// ...
backend.add(import('@openchoreo/backstage-plugin-openchoreo-ci-backend'));
```

## Development

This plugin backend can be started in a standalone mode from directly in this
package with `yarn start`. It is a limited setup that is most convenient when
developing the plugin backend itself.

If you want to run the entire project, including the frontend, run `yarn start` from the root directory.
