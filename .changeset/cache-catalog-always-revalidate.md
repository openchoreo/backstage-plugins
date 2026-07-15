---
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin': patch
---

Cache catalog reads and switch the response cache to always-revalidate.

The catalog list and entity pages now read through a `CachingCatalogApi` wrapper
(exported from `@openchoreo/backstage-plugin-react`) that routes
`getEntities`/`queryEntities`/`getEntityByRef`/`getEntitiesByRefs` through the
shared `queryClient`, keyed per signed-in user. Previously the catalog used
Backstage's `CatalogApi` directly, so every visit re-fetched from scratch and
flashed a loading skeleton; now a revisited catalog list or entity page paints
instantly from the warm cache. Catalog writes (`refreshEntity`, location
add/remove/update, `removeEntityByUid`) invalidate the cache so user changes show
immediately.

The `queryClient` default `staleTime` changes from 30s to 0 (always
stale-while-revalidate): a revisited surface paints cached data instantly and
always runs a background refresh, so nothing on screen is left silently stale.
The two hooks that set an explicit 30s `staleTime` now inherit this default.
