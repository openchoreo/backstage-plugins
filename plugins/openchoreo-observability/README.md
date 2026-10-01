# @openchoreo/backstage-plugin-openchoreo-observability

Backstage frontend plugin that adds OpenChoreo's **observability** tabs to catalog
entity pages: runtime logs and events, metrics, distributed traces, alerts, wirelogs,
audit logs, AI root-cause analysis, and cost insights.

![Built-in observability](https://openchoreo.dev/img/explore/backstage-powered-developer-portal/built-in-observability.png)

This is an optional add-on to the OpenChoreo **Core** install
([`@openchoreo/backstage-plugin`](https://www.npmjs.com/package/@openchoreo/backstage-plugin)),
and needs the OpenChoreo observability plane deployed in your cluster
(`./install.sh --with-observability` on the k3d quick start). Without it the tabs
install and render, but have no data behind them.

## Installation

```bash
yarn workspace app add @openchoreo/backstage-plugin-openchoreo-observability
yarn workspace backend add @openchoreo/backstage-plugin-openchoreo-observability-backend
```

The backend half is required — it serves the telemetry these tabs render.

**Full setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
