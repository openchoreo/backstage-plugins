---
'@openchoreo/backstage-plugin': minor
---

Generalize the listing row delete beyond components. The new
`useDeleteEntityDialog` hook (replacing `useDeleteComponentDialog`) dispatches
deletes for every kind the OpenChoreo API supports — components, projects,
namespaces, resources and the platform resource kinds — sharing one dispatch
with the entity-page context menu. A reusable `RowDeleteButton` +
`usePendingDeletionOverlay` pair wires per-row delete (with an optimistic
"marked for deletion" badge) into the catalog "All ..." pages, the namespace
projects/resources cards, and extends the Project Contents row action to
resource rows.
