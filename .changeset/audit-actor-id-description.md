---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Describe `actor.id` in the audit log filter and event drawer as the identity
claim set per actor type, rather than as the token's `sub` claim. Which claim
is recorded now depends on the actor's auth mechanism, so a service account
shows a client id where a person shows a username.
