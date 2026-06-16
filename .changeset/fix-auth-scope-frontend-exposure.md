---
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': patch
'@openchoreo/backstage-plugin-common': patch
---

Fix OAuth scopes in the auth code flow: inject configured scope into the passport-oauth2 token exchange and refresh, and expose the scope to the frontend client via `openchoreo.features.auth.scope` so sign-in and session refresh requests use the operator-configured scope instead of hardcoded defaults.
