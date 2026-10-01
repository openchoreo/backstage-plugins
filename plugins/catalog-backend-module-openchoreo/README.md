# @openchoreo/backstage-plugin-catalog-backend-module

This is the OpenChoreo backend module for the Backstage catalog plugin.

## Installation

Add the module to your Backstage backend:

```bash
yarn workspace backend add @openchoreo/backstage-plugin-catalog-backend-module
```

## Configuration

Add the OpenChoreo configuration to your `app-config.yaml`:

```yaml
openchoreo:
  baseUrl: http://localhost:8080/api/v1
  token: ${OPENCHOREO_TOKEN} # optional: for authentication
```

## Usage

Register the module in your backend:

```typescript
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins

// Add the OpenChoreo catalog module
backend.add(import('@openchoreo/backstage-plugin-catalog-backend-module'));

backend.start();
```

## Features

- **Entity Provider**: Automatically discovers and ingests projects from OpenChoreo API as Backstage System entities
- **Scheduled Updates**: Runs every 30 minutes to keep entities in sync
- **Configuration-based**: Uses Backstage configuration system for API connection details

## Entity Mapping

The module syncs the OpenChoreo control plane into the software catalog on a schedule.
OpenChoreo namespaces become Domains and projects become Systems; components and
resources become Components and Resources; and the platform's own objects —
environments, deployment pipelines, workflows, and the project/component/resource/trait
type definitions — are ingested as OpenChoreo-specific kinds that the OpenChoreo
frontend plugin renders. Entities are tagged and annotated with their OpenChoreo
identity so the portal can map them back to the control plane.

For the full entity model and sync behavior see
[Catalog sync](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/catalog-sync/).

## Development

To work on this module:

```bash
# Start in development mode
yarn start

# Run tests
yarn test

# Build for production
yarn build
```

## Documentation

- [Catalog sync](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/catalog-sync/)
- [Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/)

## License

Apache-2.0
