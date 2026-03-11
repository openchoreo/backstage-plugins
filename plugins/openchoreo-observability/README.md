# openchoreo-observability

Welcome to the openchoreo-observability plugin!

_This plugin was created through the Backstage CLI_

## Features

- **Logs**: Component-level and project-level runtime logs with filtering
- **Metrics**: Resource and HTTP metrics for components
- **Traces**: Distributed tracing for component requests
- **Alerts**: Component-level triggered alerts with severity, time range, and environment filters. Alerts can link to the project Incidents tab when incident management is enabled.
- **Incidents**: Project-level incidents with status, component, and environment filters. Incidents with AI RCA enabled can link to the RCA Reports tab.
- **RCA Reports**: Root cause analysis reports for incidents

## Getting started

Your plugin has been added to the example app in this repository, meaning you'll be able to access it by running `yarn start` in the root directory, and then navigating to [/openchoreo-observability](http://localhost:3000/openchoreo-observability).

You can also serve the plugin in isolation by running `yarn start` in the plugin directory.
This method of serving the plugin provides quicker iteration speed and a faster startup and hot reloads.
It is only meant for local development, and the setup for it can be found inside the [/dev](./dev) directory.
