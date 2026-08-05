---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Clarify the scaffolder's CI identifier field: it takes a Jenkins job
**full name** (`my-folder/my-job`), not a `/job/...` URL path. The plugin adds
the `/job/` segments itself, so a URL-style value resolves to a folder literally
named `job` and 404s.
