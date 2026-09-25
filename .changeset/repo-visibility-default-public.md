---
'@openchoreo/backstage-plugin': patch
---

Default the new-repository visibility to `public` (was `private`) in the
create-repo scaffolder fields, so the build can clone without a git secret in the
common flow. Users can still select `private` explicitly.
