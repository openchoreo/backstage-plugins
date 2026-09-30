---
'@openchoreo/backstage-plugin': minor
---

Make `@openchoreo/backstage-plugin/alpha` work under Backstage feature
discovery. The default export is now a feature loader that yields the plugin
together with `openChoreoAppModule`, instead of the plugin on its own.

Feature discovery is enabled by default in new Backstage apps, but it only
reads the _default_ export of a package's root and `./alpha` entry points.
`openChoreoAppModule` was a named export, so a host that relied on discovery
got the plugin without it — the entity tabs mounted and then threw on first
render, because that module is what supplies the shared query client and the
`fetchApi`/`permissionApi` overrides that attach the user's IDP token.

`openChoreoEntityGroupsModule` is intentionally left out of the bundle: it is
recommended rather than required, and hosts that pin their own entity tab
groups should not have ours applied implicitly.

The plugin itself is still available as the named export `openChoreoPlugin`,
and listing any of these explicitly in `createApp({ features })` keeps
working — a module applied twice simply re-applies the same implementation.
