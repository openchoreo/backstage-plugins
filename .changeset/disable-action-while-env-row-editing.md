---
'@openchoreo/backstage-plugin': patch
---

Disable the primary action (Create Release / Save Overrides / Deploy) on
the deploy flow while an environment variable or file mount row is in
edit mode, so users can't submit a half-typed row with an empty key or
value.
