---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-design-system': patch
---

Clarify the save/discard/delete controls in the Workload editor rows
(endpoints, dependencies, environment variables, and file mounts). While
editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
or discarding clearly visible; read-only rows keep their compact inline
Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
design-system component shared by all of those row editors.
