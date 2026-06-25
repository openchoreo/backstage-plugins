---
'@openchoreo/backstage-plugin': minor
---

Add a per-row "Delete" action to the Project Contents table so a component
can be deleted directly from the project listing without opening the
component page first. The action surfaces in a row "more actions" kebab for
component rows (hidden for resources and for rows already marked for
deletion), reuses the shared delete-confirmation dialog, and refreshes the
listing once the component is marked for deletion.
