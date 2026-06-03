---
'@openchoreo/backstage-plugin': patch
---

Rework the Environments setup card auto-deploy experience: searchable
release dropdown with a primary "New release" CTA, an empty-state
panel for brand-new components, an optimistic auto-deploy toggle with
inline "Saving…" feedback and permission-aware error handling, and a
controller-truth "Last deployed release" row that polls for the new
release after a save.
