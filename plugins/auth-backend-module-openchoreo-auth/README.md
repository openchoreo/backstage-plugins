# @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth

Backstage auth backend module that adds **OpenChoreo** as a sign-in provider.

OpenChoreo delegates identity to an OIDC-compliant identity provider (Thunder by
default), and this module wires that provider into `@backstage/plugin-auth-backend` so
portal users sign in with their platform identity. The resulting IDP token is what the
OpenChoreo backend plugins present to the control plane on the user's behalf — so
sign-in is part of the OpenChoreo **Core** install, not an optional extra.

Works with any OIDC-compliant IDP configured in OpenChoreo.

## Installation

```bash
yarn workspace backend add @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth
```

```ts title="packages/backend/src/index.ts"
import { OpenChoreoAuthModule } from '@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth';

backend.add(OpenChoreoAuthModule);
```

`OpenChoreoAuthModule` is also this package's default export, so the module is picked
up by Backstage's backend feature discovery (`backend.add(discoveryFeatureLoader)`)
when you use that instead of explicit wiring.

Provider credentials are configured under `auth.providers.openchoreo-auth` in
`app-config.yaml` — the key must match the registered provider ID.

**Full setup instructions** — including the frontend sign-in page and the IDP token
middleware:
[Installing into an existing Backstage app](https://openchoreo.dev/docs/platform-engineer-guide/backstage-plugins/installing-into-existing-backstage/).

## License

Apache-2.0
