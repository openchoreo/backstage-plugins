---
'@openchoreo/cell-diagram': patch
---

Fix the diagram drawing a stale layout when it draws again within its load delay,
as under React StrictMode or when its props change: only the latest draw now lays
out the diagram and fits the zoom.
