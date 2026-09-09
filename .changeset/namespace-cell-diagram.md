---
'@openchoreo/cell-diagram': minor
---

Support namespace-level (organization) cell diagrams. Re-export `CellBounds`
from the public API so hosts can build `Organization`/`OrgConnection` models,
and add single-click navigation on org-view project cells (fires
`onComponentDoubleClick` with the project id, guarded so canvas pan/drag does
not navigate).
