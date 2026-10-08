---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
---

Stop overriding the app-wide fetch API and attach the OpenChoreo user token to
OpenChoreo requests only.

`openChoreoAppModule` registered an `api:app/core.fetch` override. In the
portal that was invisible, but in any other Backstage host it replaced the
app's own fetch API for every installed plugin — dropping the default
middleware chain (`plugin://` resolution, failure clarification, and identity
injection scoped to the host's own `backend.baseUrl`) and attaching both the
Backstage token and the OpenChoreo IDP token to every outbound request
regardless of destination.

Requests bound for an OpenChoreo backend now go through a new
`openChoreoFetchApiRef`, which decorates the host's `fetchApiRef` instead of
replacing it. The host keeps its middleware, and OpenChoreo credentials travel
only to OpenChoreo.

Destinations are checked rather than trusted: the IDP token is attached only to
requests bound for `backend.baseUrl`, so a caller passing an unrelated URL
cannot send the user's credentials to a third party. Direct mode (the
`x-openchoreo-direct` signal) remains an explicit per-request opt-in for
external OpenChoreo services.

The token itself comes from a new `openChoreoTokenApiRef` capability rather
than from a named auth provider. The default implementation sources it from the
`openchoreo-auth` OAuth provider exactly as before, so nothing changes for the
portal; a host whose own session already carries an OpenChoreo-accepted token
can now override that one API instead of forking the plugins.

`OpenChoreoFetchApi` from `@openchoreo/backstage-plugin` is deprecated and no
longer registered. `OPENCHOREO_TOKEN_HEADER` and `OPENCHOREO_DIRECT_HEADER` are
now exported from `@openchoreo/backstage-plugin-common` as the single
definition shared by both sides of the wire.
