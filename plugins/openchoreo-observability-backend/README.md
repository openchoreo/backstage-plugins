# @openchoreo/backstage-plugin-openchoreo-observability-backend

Backend half of the OpenChoreo observability plugin. Mounts at
`/api/openchoreo-observability` and serves runtime logs, metrics, traces, alerts,
audit logs, and cost data from the OpenChoreo observability plane to
[`@openchoreo/backstage-plugin-openchoreo-observability`](https://www.npmjs.com/package/@openchoreo/backstage-plugin-openchoreo-observability).

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-openchoreo-observability-backend
```

```ts title="packages/backend/src/index.ts"
backend.add(
  import('@openchoreo/backstage-plugin-openchoreo-observability-backend'),
);
```

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
