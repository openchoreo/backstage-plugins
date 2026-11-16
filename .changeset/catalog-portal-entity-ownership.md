---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Remove entities created from the portal once they are deleted in OpenChoreo. `ImmediateCatalogService` now writes through `OpenChoreoEntityProvider`, so its delete events and full sync own and remove those entities. Previously an entity deleted before the next full sync stayed in the catalog indefinitely.

`ScaffolderEntityProvider` is no longer registered and is deprecated. Entities it left behind are cleaned up on startup by the catalog's orphaned-provider eviction (`catalog.orphanProviderStrategy`, default `delete`). If you set that option to `keep`, remove the leftover entities manually.
