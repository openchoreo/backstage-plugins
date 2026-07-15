---
'@openchoreo/backstage-plugin': patch
---

Use the standard Backstage `EmptyState` for the Deploy tab's empty and error states (Component, Project, and Resource), matching the look of other empty states in the app (e.g. "Workflows Not Available" on the Build tab). Replaces the card + custom message + Retry button with a title + description empty state, and the "no environments" state now links to the project's deployment pipeline so it can be reviewed/configured.
