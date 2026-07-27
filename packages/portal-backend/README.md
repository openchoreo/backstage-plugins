# @openchoreo/backstage-portal-backend

The OpenChoreo Portal's backend composition as a reusable package. It bundles
every backend plugin, module, and service factory the stock portal runs, so a
custom portal backend is a few lines:

```ts
import { createBackend } from '@backstage/backend-defaults';
import {
  portalBackendFeatures,
  portalRootHttpRouterServiceFactory,
} from '@openchoreo/backstage-portal-backend';

const backend = createBackend();

backend.add(portalRootHttpRouterServiceFactory);
backend.add(portalBackendFeatures);

// Add your own plugins alongside:
// backend.add(import('@internal/my-plugin-backend'));

backend.start();
```

## Exports

- `portalBackendFeatures` — a feature loader bundling the Backstage core
  plugins (app, auth, catalog, scaffolder, search, techdocs, permission,
  events, proxy, user-settings), the Jenkins CI integration, and all
  OpenChoreo backend plugins and modules, in the required registration order.
- `portalRootHttpRouterServiceFactory` — the root HTTP router pre-configured
  with the OpenChoreo IDP token header middleware. Kept separate from the
  bundle so hosts can substitute their own root-router configuration.
