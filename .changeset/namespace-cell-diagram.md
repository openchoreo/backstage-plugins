---
'@openchoreo/cell-diagram': minor
---

Support namespace-level (organization) cell diagrams. Re-export `CellBounds`
from the public API so hosts can build `Organization`/`OrgConnection` models,
and add single-click navigation on org-view project cells (fires
`onComponentDoubleClick` with the project id, guarded so canvas pan/drag does
not navigate).

Clicking a cell in the org (namespace) view opens an in-place preview of that
project's cell diagram — the same single-project view, reusing data already
fetched — with a "Go to Project" action that navigates to the project's
cell-diagram tab. This is driven entirely by the existing
`onComponentDoubleClick` callback. The org-view cell's hover affordance now uses
a zoom-in icon (with a "Preview Project" tooltip) instead of the open-in-new
icon, reflecting that the click opens an inline preview rather than navigating
away.
