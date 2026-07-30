---
'@openchoreo/backstage-plugin': minor
---

Add a per-row "Delete" action to the Project Contents table so a component
can be deleted directly from the project listing without opening the
component page first. The action surfaces as a per-row delete button for
both component and resource rows (hidden for rows already marked for
deletion), reuses the shared delete-confirmation dialog, and optimistically
marks the row for deletion until the next catalog sync drops it.
