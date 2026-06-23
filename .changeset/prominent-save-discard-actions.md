---
'@openchoreo/backstage-plugin': patch
---

Replace the small icon-only save/discard/delete controls in the Workload
editor rows (endpoints, dependencies, environment variables, and file mounts)
with a labeled footer action bar (Save / Cancel / Delete), so committing or
discarding inline edits is clearly visible. Adds a reusable `EditRowActions`
design-system component shared by all of those row editors.
