---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Fix the error stripe not rendering on error rows in the traces table. The red
"contains errors" indicator was drawn by CSS targeting table cells (`td`/`th`)
that no longer exist after the table moved to a div-based virtualized layout,
and the span that did render (the tooltip's hover target) had no fill colour.
The stripe is now drawn on the rendered element, so error traces show the red
stripe again.
