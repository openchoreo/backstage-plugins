---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Let the expanded panel of a log or event row be selected and copied. The
expand/collapse handler covered the whole row, expanded panel included, so the
`click` completing a drag-select collapsed the row and discarded the selection
— the full message and every metadata value were impossible to copy.

The handler now sits on the summary row only, leaving the expanded panel
outside the click target. Clicking the summary row expands and collapses
exactly as before.
