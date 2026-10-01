# @openchoreo/backstage-plugin-openchoreo-workflows-backend

Backend half of the OpenChoreo generic workflows plugin. Mounts at
`/api/openchoreo-workflows` and serves workflow definitions and workflow runs from the
OpenChoreo control plane to
[`@openchoreo/backstage-plugin-openchoreo-workflows`](https://www.npmjs.com/package/@openchoreo/backstage-plugin-openchoreo-workflows).

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-openchoreo-workflows-backend
```

```ts title="packages/backend/src/index.ts"
backend.add(
  import('@openchoreo/backstage-plugin-openchoreo-workflows-backend'),
);
```

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
