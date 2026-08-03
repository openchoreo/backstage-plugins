# @openchoreo/backstage-portal-backend

The OpenChoreo Portal's backend composition as a reusable package. It bundles
every backend plugin, module, and service factory the stock portal runs, so a
custom portal backend is a few lines:

```ts
import { createBackend } from '@backstage/backend-defaults';
import { portalBackendFeatures } from '@openchoreo/backstage-portal-backend';

const backend = createBackend();

backend.add(portalBackendFeatures);

// Add your own plugins alongside:
// backend.add(import('@internal/my-plugin-backend'));

backend.start();
```

## Exports

- `portalBackendFeatures` — a feature loader bundling the portal's root HTTP
  router (IDP token middleware), the Backstage core plugins (app, auth,
  catalog, scaffolder, search, techdocs, permission, events, proxy,
  user-settings), the Jenkins CI integration, and all OpenChoreo backend
  plugins and modules, in the required registration order.
- `portalRootHttpRouterServiceFactory` — the root HTTP router pre-configured
  with the OpenChoreo IDP token header middleware. Already part of
  `portalBackendFeatures`; exported for hosts composing a custom backend.

## Substituting your own root HTTP router

`portalBackendFeatures` includes the root router because the bundled
OpenChoreo permission policy needs its IDP-token middleware — without it,
`openchoreo.*` authorization silently fails closed. Adding a second
root-router factory next to the bundle fails startup with
`Duplicate service implementations provided for core.rootHttpRouter`.

To bring your own root router, skip the bundle and compose from the exported
building blocks (`portalServiceFactories` + `portalFeatureLoaders`), making
sure your router still applies `createIdpTokenHeaderMiddleware` from
`@openchoreo/openchoreo-auth`.
