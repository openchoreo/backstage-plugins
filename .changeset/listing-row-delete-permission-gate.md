---
'@openchoreo/backstage-plugin-react': minor
---

New `useEntityDeletePermission` hook checks the kind-mapped delete permission
for a given entity (sharing the mapping used by
`useResourceDefinitionPermission`), so listings can gate per-row actions. The
`RowDeleteButton` now renders disabled with an explanatory tooltip when the
logged-in user lacks permission to delete the row's entity.
