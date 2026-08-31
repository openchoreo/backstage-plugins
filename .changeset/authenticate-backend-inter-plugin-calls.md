---
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': patch
---

Authenticate backend-to-backend calls (scaffolder catalog reads and the
sign-in `cache-capabilities` hook) with a service identity so they no longer
return `401` once the default auth policy is enforced.
