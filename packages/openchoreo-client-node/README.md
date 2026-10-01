# @openchoreo/openchoreo-client-node

Node.js client for the [OpenChoreo](https://openchoreo.dev) control plane API, with
TypeScript types generated from the OpenChoreo OpenAPI specification.

The OpenChoreo Backstage backend plugins use it to talk to the control plane, and they
depend on it directly — so a Backstage host does not need to install it explicitly. It
is also usable on its own in any Node service that needs typed access to the same API.

## Installation

```bash
yarn add @openchoreo/openchoreo-client-node
```

Types are regenerated from the upstream OpenAPI spec via
[`@openchoreo/openapi-client-generator-node`](../openapi-client-generator-node), so the
client tracks the control plane API rather than being hand-maintained.

**Backstage setup instructions**:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
