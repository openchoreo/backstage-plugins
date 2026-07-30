---
'backend': patch
---

Derive Backstage's dangerous auth flags from the auth feature flag instead of
hardcoding them to `true`, closing an unauthenticated-access hole where the whole
backend API (`/api/*`) was served without credentials — anyone could read the
software catalog and scaffolder logs and create or delete catalog locations.

`backend.auth.dangerouslyDisableDefaultAuthPolicy` and
`auth.providers.guest.dangerouslyAllowOutsideDevelopment` are now `${...}`
substitutions in `app-config.yaml` / `app-config.production.yaml`. When
`OPENCHOREO_FEATURES_AUTH_ENABLED=false` (guest/demo mode),
`packages/backend/src/index.ts` sets the backing env vars to `true`; in any other
case they stay unset, so the keys drop out and Backstage's secure defaults apply
— anonymous API requests get `401` and guest sign-in `403`. Explicitly set env
vars are never overridden (`??=`), keeping the behaviour fail-secure.
