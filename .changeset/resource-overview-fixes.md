---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin': patch
---

Render `<resource:name>` entity tags in RCA reports as catalog links, instead
of dropping them as unknown HTML along with the resource name. Clamp resource
parameter values to three lines, so a long value no longer stretches every
card in the overview row.
