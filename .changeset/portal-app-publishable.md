---
'@openchoreo/backstage-portal-app': minor
---

Publish `@openchoreo/backstage-portal-app`. The shell is fully on the new
frontend system and no longer depends on the private Portal Assistant, so it
now releases in lockstep with the other `@openchoreo/*` packages (it joins the
changeset linked group). The unused `@backstage/core-compat-api` dependency is
dropped.
