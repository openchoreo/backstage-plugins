---
'@openchoreo/backstage-portal-backend': minor
---

Add `@openchoreo/backstage-portal-backend` — the stock portal's backend
composition (feature bundle + IDP root-router middleware) as a reusable
published package. The monorepo backend now consumes it; runtime behavior is
unchanged. The app shell also moves into the private
`@openchoreo/backstage-portal-app` package (`createPortalApp()`), leaving
`packages/app` as a thin consumer — the shared base for the new-frontend-system
migration and the custom-portal scaffold.
