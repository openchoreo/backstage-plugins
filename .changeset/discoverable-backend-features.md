---
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
---

Make both packages work under Backstage backend feature discovery
(`backend.add(discoveryFeatureLoader)`), which reads a package's **default**
export only.

`@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth` had no
default export at all — `OpenChoreoAuthModule` was reachable as a named export
alone, which is why the install guide adds it with
`backend.add(OpenChoreoAuthModule)` while every sibling package uses a dynamic
import. It is now also the default export.

`@openchoreo/backstage-plugin-catalog-backend-module` exported the catalog
module as its default, but `immediateCatalogServiceFactory` and
`annotationStoreFactory` were named exports, so discovery installed the module
without the two services it and `@openchoreo/backstage-plugin-backend` depend
on. The default export is now a backend feature loader yielding all three.

Existing explicit wiring is unaffected. A service factory installed explicitly
with `backend.add(...)` takes precedence over one offered by a feature loader,
and the loader's copy is ignored rather than colliding.
