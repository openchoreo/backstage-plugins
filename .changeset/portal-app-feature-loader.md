---
'@openchoreo/backstage-portal-app': minor
---

Make the portal shell installable by Backstage frontend feature discovery. The
new `@openchoreo/backstage-portal-app/alpha` entry point default-exports a
feature loader carrying the whole portal, and the package's `backstage.role`
changes from `web-library` to `frontend-plugin-module` so discovery can see it.
A host now installs the shell with a dependency plus `app.packages` in config,
and needs no `features` array.

A loader rather than a flat list of modules because that is the only shape
discovery can consume — one package contributes one default export — and
because a loader's features are spliced in at the loader's own position, in the
order it returns them. The portal's three order-dependent pairs (API modules
before the plugin-scoped `withOverrides`, Build before Deploy, Platform
Overview before Platform Logs) therefore survive discovery, and are now pinned
by tests instead of comments.

`createPortalApp()` keeps working and is unchanged for callers. It now reads the
same loader, so the two installation paths cannot drift, and using both at once
is safe — feature loaders are de-duplicated by reference. Its `bindRoutes` is
gone: all five bindings it declared are already the upstream `defaultTarget` of
the external route refs involved, so `resolveRouteBindings` applies them
anyway. `advanced.loadingElement` is the only thing the function still adds that
a feature cannot.
