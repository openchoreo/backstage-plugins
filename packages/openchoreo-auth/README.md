# @openchoreo/openchoreo-auth

Token management for Backstage backends that call the
[OpenChoreo](https://openchoreo.dev) control plane.

It provides:

- **User token extraction** — Express middleware that lifts the caller's identity
  provider token off the incoming request so downstream calls act as the signed-in
  user rather than as the portal.
- **Service tokens** — an OAuth2 client-credentials provider for calls with no user
  in the loop, such as the catalog entity provider's background sync.
- **A no-op implementation** for deployments running with OpenChoreo authentication
  disabled.

The OpenChoreo Backstage backend plugins depend on it; you install it as part of the
**Core** backend set and register its root-router middleware once.

## Installation

```bash
yarn workspace backend add @openchoreo/openchoreo-auth
```

```ts title="packages/backend/src/index.ts"
import { createIdpTokenHeaderMiddleware } from '@openchoreo/openchoreo-auth';
```

**Full setup instructions** — the middleware must be registered on the backend root
router for user-scoped calls to work:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
