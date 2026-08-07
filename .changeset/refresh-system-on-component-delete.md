---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Refresh the parent System when a component is removed so its now-dangling
`hasPart` relation is dropped. Without this, deleting a component left the
project page showing "Some related entities could not be found in the catalog"
until the catalog was rebuilt, because the System's relations are only
recomputed when it is re-processed and the periodic full sync re-emits it
unchanged.
